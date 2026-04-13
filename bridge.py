#!/usr/bin/env python3
import base64
import time

import threading

import cv2
import numpy as np
import requests

# Configuration
ESP32_IP         = "192.168.0.182"
# Switch to BACKEND_URL_AWS for campus demo
BACKEND_URL      = "http://localhost:8001"
BACKEND_URL_AWS  = "https://tm.zainecs.com"  # production AWS backend
SESSION_ID       = 3
USERNAME         = "lecturer"
PASSWORD         = "lecturer"

PAN_MIN          = 20
PAN_MAX          = 160
TILT_MIN         = 30
TILT_MAX         = 150

DEADZONE         = 0.08
KP               = 30.0
MAX_STEP         = 12.0
SMOOTH_ALPHA     = 0.75

FRAME_INTERVAL   = 0.1   # seconds between recognition requests (~10 FPS)
SERVO_INTERVAL   = 0.033 # seconds between servo commands (~30 Hz)

FACE_LOST_HOLD   = 2.0   # seconds to hold position after face is lost
RETURN_SPEED     = 2.0   # degrees per servo tick when returning to home
MIN_FACE_SIZE    = 30    # ignore face detections smaller than this (pixels, on upscaled image)
JUMP_THRESHOLD   = 0.4   # reject detection if face jumps >40% of frame in one step

HOME_PAN         = 90.0  # pan home position for return-to-centre
HOME_TILT        = 100.0 # tilt home position for return-to-centre

FRAME_WIDTH      = 320   # ESP32 QVGA
FRAME_HEIGHT     = 240

UPSCALE_WIDTH    = 640   # upscale target for better distant-face detection
UPSCALE_HEIGHT   = 480

# Helpers

def authenticate() -> str:
    # Log in to the backend and return a JWT token.
    resp = requests.post(
        f"{BACKEND_URL}/api/auth/login/json",
        json={"username": USERNAME, "password": PASSWORD},
        timeout=10,
    )
    resp.raise_for_status()
    token = resp.json()["access_token"]
    return token


def grab_frame() -> bytes:
    # Fetch a single JPEG snapshot from the ESP32 camera.
    resp = requests.get(f"http://{ESP32_IP}/jpg", timeout=5)
    resp.raise_for_status()
    return resp.content


def recognize(jpeg_bytes: bytes, token: str) -> dict:
    # Send a frame to the backend recognize-frame endpoint.
    b64 = base64.b64encode(jpeg_bytes).decode("utf-8")
    resp = requests.post(
        f"{BACKEND_URL}/api/sessions/{SESSION_ID}/recognize-frame",
        json={"image_base64": b64},
        headers={"Authorization": f"Bearer {token}"},
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()


def send_servo(pan: int, tilt: int) -> None:
    # Send a servo position command to the ESP32 (best-effort).
    try:
        requests.get(
            f"http://{ESP32_IP}/servo",
            params={"pan": pan, "tilt": tilt},
            timeout=0.5,
        )
    except Exception:
        pass  # servo commands are best-effort


def clamp(value: float, lo: float, hi: float) -> float:
    # Clamp a value between lo and hi.
    return max(lo, min(hi, value))


def smooth_step(current: float, target: float, alpha: float, max_step: float) -> float:
    # Apply EMA smoothing with a maximum step size per update.
    desired = alpha * target + (1.0 - alpha) * current
    delta = desired - current
    if abs(delta) > max_step:
        delta = max_step if delta > 0 else -max_step
    return current + delta


# Frame preprocessing for distant-face improvement
_clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))

_sharpen_kernel = np.array(
    [[ 0, -0.5,  0],
     [-0.5,  3, -0.5],
     [ 0, -0.5,  0]], dtype=np.float32,
)


def preprocess_frame(jpeg_bytes: bytes):
    # Upscale, apply CLAHE contrast enhancement, and sharpen a JPEG frame.
    #
    # Returns (bgr_upscaled, jpeg_enhanced):
    #   bgr_upscaled  – OpenCV BGR array at UPSCALE_WIDTH×UPSCALE_HEIGHT (for local detection)
    #   jpeg_enhanced – re-encoded JPEG bytes ready to send to backend
    # Returns (None, None) on decode failure.
    nparr = np.frombuffer(jpeg_bytes, np.uint8)
    bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if bgr is None:
        return None, None

    # 1) Upscale with bicubic interpolation
    bgr = cv2.resize(bgr, (UPSCALE_WIDTH, UPSCALE_HEIGHT), interpolation=cv2.INTER_CUBIC)

    # 2) CLAHE on the L channel of LAB colour space
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
    l_ch, a_ch, b_ch = cv2.split(lab)
    l_ch = _clahe.apply(l_ch)
    lab = cv2.merge([l_ch, a_ch, b_ch])
    bgr = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)

    # 3) Mild sharpening to recover edge detail lost to JPEG compression
    bgr = cv2.filter2D(bgr, -1, _sharpen_kernel)

    # Re-encode as JPEG for the backend
    ok, buf = cv2.imencode('.jpg', bgr, [cv2.IMWRITE_JPEG_QUALITY, 90])
    if not ok:
        return None, None
    return bgr, bytes(buf)


# Local face detection for fast servo tracking
_face_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_alt2.xml"
)


def detect_face_local(bgr_upscaled):
    if bgr_upscaled is None:
        return None
    gray = cv2.cvtColor(bgr_upscaled, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)
    # minNeighbors=5 acts as a confidence filter — rejects weak/ghost detections
    faces = _face_cascade.detectMultiScale(
        gray, scaleFactor=1.15, minNeighbors=5, minSize=(30, 30)
    )
    if len(faces) == 0:
        return None
    largest = max(faces, key=lambda f: f[2] * f[3])
    x, y, w, h = largest
    # Ignore very small / distant faces (in upscaled pixels)
    if w < MIN_FACE_SIZE or h < MIN_FACE_SIZE:
        return None
    # Scale centre coordinates back to original resolution
    sx = FRAME_WIDTH  / UPSCALE_WIDTH
    sy = FRAME_HEIGHT / UPSCALE_HEIGHT
    return (x + w / 2.0) * sx, (y + h / 2.0) * sy



# Main loop


def main() -> None:
    print("=" * 60)
    print("IoT Smart Attendance System - Hardware Bridge")
    print(f"  ESP32 IP   : {ESP32_IP}")
    print(f"  Backend URL: {BACKEND_URL}")
    print(f"  Session ID : {SESSION_ID}")
    print("=" * 60)

    print("Authenticating")
    token = authenticate()
    print("Authenticated OK")

    # ── Shared tracking state (accessed by detection loop + servo thread) ──
    state_lock = threading.Lock()
    state = {
        "pan": HOME_PAN,
        "tilt": HOME_TILT,
        "target_pan": HOME_PAN,
        "target_tilt": HOME_TILT,
        "face_visible": False,
        "last_face_time": 0.0,
        "last_cx": FRAME_WIDTH / 2.0,
        "last_cy": FRAME_HEIGHT / 2.0,
        "running": True,
    }

    # Background recognition state
    recog_busy = False
    recog_lock = threading.Lock()

    def _run_recognition(jpeg_bytes: bytes) -> None:
        nonlocal token, recog_busy
        try:
            result = recognize(jpeg_bytes, token)
        except requests.exceptions.HTTPError as e:
            if e.response is not None and e.response.status_code == 401:
                print("[WARN] Token expired, re-authenticating...")
                try:
                    token = authenticate()
                    result = recognize(jpeg_bytes, token)
                except Exception as e2:
                    print(f"[ERROR] Re-auth failed: {e2}")
                    with recog_lock:
                        recog_busy = False
                    return
            else:
                print(f"[ERROR] Recognition failed: {e}")
                with recog_lock:
                    recog_busy = False
                return
        except Exception as e:
            print(f"[ERROR] Recognition failed: {e}")
            with recog_lock:
                recog_busy = False
            return

        frame_processed = result.get("frame_processed", False)
        if not frame_processed:
            print("Session paused")
            with recog_lock:
                recog_busy = False
            return

        students = result.get("recognized_students") or []
        for s in students:
            if not s.get("is_unknown"):
                name = s.get("student_name", "Unknown")
                conf = s.get("confidence", 0.0)
                print(f"  Recognised: {name} ({conf:.2f})")

        with recog_lock:
            recog_busy = False

    # ── Servo thread — runs at consistent ~30 Hz, never blocked by I/O ────
    def _servo_loop() -> None:
        while True:
            with state_lock:
                if not state["running"]:
                    break
                face_vis = state["face_visible"]
                last_ft  = state["last_face_time"]
                pan      = state["pan"]
                tilt     = state["tilt"]
                t_pan    = state["target_pan"]
                t_tilt   = state["target_tilt"]

            now = time.time()

            if face_vis:
                # Active tracking — smooth step toward face
                pan  = smooth_step(pan, t_pan, SMOOTH_ALPHA, MAX_STEP)
                tilt = smooth_step(tilt, t_tilt, SMOOTH_ALPHA, MAX_STEP)
                pan  = clamp(pan, PAN_MIN, PAN_MAX)
                tilt = clamp(tilt, TILT_MIN, TILT_MAX)
                send_servo(int(round(pan)), int(round(tilt)))
            elif (now - last_ft) > FACE_LOST_HOLD:
                # Face lost for >2 s — smoothly interpolate back to home
                moved = False
                if abs(pan - HOME_PAN) > 1.0:
                    pan += RETURN_SPEED if pan < HOME_PAN else -RETURN_SPEED
                    moved = True
                else:
                    pan = HOME_PAN
                if abs(tilt - HOME_TILT) > 1.0:
                    tilt += RETURN_SPEED if tilt < HOME_TILT else -RETURN_SPEED
                    moved = True
                else:
                    tilt = HOME_TILT
                if moved:
                    t_pan = pan
                    t_tilt = tilt
                    send_servo(int(round(pan)), int(round(tilt)))
            # else: face just lost — hold position (do nothing)

            with state_lock:
                state["pan"] = pan
                state["tilt"] = tilt
                state["target_pan"] = t_pan
                state["target_tilt"] = t_tilt

            time.sleep(SERVO_INTERVAL)

    # Centre the mount on startup
    send_servo(int(round(HOME_PAN)), int(round(HOME_TILT)))
    print("Servos centred.")

    servo_thread = threading.Thread(target=_servo_loop, daemon=True)
    servo_thread.start()

    print("Starting tracking loop (local face detection + background recognition)...")

    last_recognition = 0.0

    while True:
        now = time.time()

        # ── Grab a frame from ESP32 
        try:
            jpeg_bytes = grab_frame()
        except Exception as e:
            print(f"[ERROR] Frame grab failed: {e}")
            time.sleep(0.05)
            continue

        # ── Preprocess 
        bgr_up, enhanced_jpeg = preprocess_frame(jpeg_bytes)
        if bgr_up is None:
            time.sleep(0.01)
            continue

        # ── Local face detection for immediate servo tracking 
        face_pos = detect_face_local(bgr_up)

        if face_pos:
            cx, cy = face_pos

            # Anti-spaz filter: reject if face centre jumps >40% of frame
            with state_lock:
                prev_cx = state["last_cx"]
                prev_cy = state["last_cy"]

            dx = abs(cx - prev_cx) / FRAME_WIDTH
            dy = abs(cy - prev_cy) / FRAME_HEIGHT

            if dx > JUMP_THRESHOLD or dy > JUMP_THRESHOLD:
                # Probable false positive — ignore this detection
                pass
            else:
                # Accept detection — update shared tracking target
                ex = (cx / FRAME_WIDTH) - 0.5
                ey = (cy / FRAME_HEIGHT) - 0.5
                if abs(ex) < DEADZONE:
                    ex = 0.0
                if abs(ey) < DEADZONE:
                    ey = 0.0

                with state_lock:
                    cur_pan  = state["pan"]
                    cur_tilt = state["tilt"]
                    state["target_pan"]  = clamp(cur_pan  + (ex * KP), PAN_MIN, PAN_MAX)
                    state["target_tilt"] = clamp(cur_tilt + (ey * KP), TILT_MIN, TILT_MAX)
                    state["face_visible"] = True
                    state["last_face_time"] = now
                    state["last_cx"] = cx
                    state["last_cy"] = cy
        else:
            with state_lock:
                state["face_visible"] = False

        # Send to backend for recognition (non-blocking)
        if now - last_recognition > FRAME_INTERVAL:
            with recog_lock:
                busy = recog_busy
            if not busy:
                with recog_lock:
                    recog_busy = True
                threading.Thread(
                    target=_run_recognition,
                    args=(enhanced_jpeg,),
                    daemon=True,
                ).start()
                last_recognition = now

        time.sleep(0.005)


if __name__ == "__main__":
    main()
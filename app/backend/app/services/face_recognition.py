"""
Face recognition service.

This module implements face detection and recognition using Pillow for image processing
and a simplified embedding approach. For production, this can be extended with
more sophisticated ML models.

Key concepts:
1. Face Detection: Simple image validation (production would use ML model)
2. Face Encoding: Generate embedding vector from image features
3. Face Matching: Compare embeddings using cosine similarity
4. Storage: Embeddings stored as binary blobs in PostgreSQL (via numpy tobytes/frombuffer)
"""

import base64
import hashlib
import io
import logging
from typing import List, Optional, Tuple

import cv2
import numpy as np
from PIL import Image
from scipy.spatial.distance import cosine

from app.config import settings

# Load OpenCV's pre-trained Haar cascades for face detection
# Using multiple cascades for better detection of moving faces
_face_cascade_default = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
_face_cascade_alt = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_alt.xml')
_face_cascade_alt2 = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_alt2.xml')
_profile_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_profileface.xml')

logger = logging.getLogger(__name__)

EMBEDDING_SIZE = 128


def decode_base64_image(image_base64: str) -> Image.Image:
    """
    Decode a base64-encoded image string to a PIL Image.
    
    Supports data URLs (data:image/...;base64,...) and raw base64.
    """
    # Strip data URL prefix if present
    if "," in image_base64:
        image_base64 = image_base64.split(",", 1)[1]
    
    # Decode base64 to bytes
    image_bytes = base64.b64decode(image_base64)
    
    # Open as PIL Image
    image = Image.open(io.BytesIO(image_bytes))
    return image.convert("RGB")


def detect_faces(image: Image.Image) -> List[Tuple[int, int, int, int]]:
    """
    Detect faces in an image using multiple OpenCV Haar cascade classifiers.
    
    Optimized for detecting moving faces (e.g., people walking past):
    - Uses multiple cascade classifiers for better coverage
    - Lower minNeighbors for faster detection with motion
    - Includes profile face detection for side views
    - Applies histogram equalization for better detection in varying lighting
    
    Returns list of face locations as (top, right, bottom, left) tuples.
    """
    # Convert PIL Image to OpenCV format (BGR)
    img_array = np.array(image)
    if len(img_array.shape) == 3 and img_array.shape[2] == 3:
        # RGB to BGR
        img_cv = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
    else:
        img_cv = img_array
    
    # Convert to grayscale for face detection
    gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
    
    # Apply histogram equalization to improve detection in varying lighting
    gray = cv2.equalizeHist(gray)
    
    all_faces = []
    
    # Detection parameters optimized for MOVING faces:
    # - scaleFactor=1.05: smaller steps = better detection of faces at various distances
    # - minNeighbors=3: lower = catches more faces even with motion blur
    # - minSize=(20, 20): smaller minimum = catches faces further away
    detection_params = {
        'scaleFactor': 1.05,
        'minNeighbors': 3,
        'minSize': (20, 20),
        'flags': cv2.CASCADE_SCALE_IMAGE
    }
    
    # Try multiple cascades for better coverage
    # Default cascade - good general detection
    faces_default = _face_cascade_default.detectMultiScale(gray, **detection_params)
    all_faces.extend(faces_default)
    
    # Alt2 cascade - better for slightly rotated faces
    faces_alt2 = _face_cascade_alt2.detectMultiScale(gray, **detection_params)
    all_faces.extend(faces_alt2)
    
    # Profile cascade for side views (people walking past)
    # Check both left and right profiles
    faces_profile = _profile_cascade.detectMultiScale(gray, **detection_params)
    all_faces.extend(faces_profile)
    
    # Flip image and check for right-facing profiles
    gray_flipped = cv2.flip(gray, 1)
    faces_profile_flipped = _profile_cascade.detectMultiScale(gray_flipped, **detection_params)
    # Adjust coordinates for flipped detections
    img_width = gray.shape[1]
    for (x, y, w, h) in faces_profile_flipped:
        # Mirror the x coordinate back
        x_mirrored = img_width - x - w
        all_faces.append((x_mirrored, y, w, h))
    
    # Remove duplicate/overlapping detections using non-maximum suppression
    face_locations = _non_max_suppression(list(all_faces), overlap_thresh=0.3)
    
    return face_locations


def _non_max_suppression(boxes: List, overlap_thresh: float = 0.3) -> List[Tuple[int, int, int, int]]:
    """
    Apply non-maximum suppression to remove overlapping face detections.
    
    This prevents the same face from being detected multiple times
    by different cascades.
    """
    if len(boxes) == 0:
        return []
    
    # Convert to numpy array
    boxes_array = np.array([[x, y, x + w, y + h] for (x, y, w, h) in boxes], dtype=np.float32)
    
    # Get coordinates
    x1 = boxes_array[:, 0]
    y1 = boxes_array[:, 1]
    x2 = boxes_array[:, 2]
    y2 = boxes_array[:, 3]
    
    # Calculate areas
    areas = (x2 - x1 + 1) * (y2 - y1 + 1)
    
    # Sort by bottom-right y coordinate (larger faces tend to be closer)
    indices = np.argsort(y2)
    
    picked = []
    while len(indices) > 0:
        # Pick the last (largest y2) box
        last = len(indices) - 1
        i = indices[last]
        picked.append(i)
        
        # Find overlap with remaining boxes
        xx1 = np.maximum(x1[i], x1[indices[:last]])
        yy1 = np.maximum(y1[i], y1[indices[:last]])
        xx2 = np.minimum(x2[i], x2[indices[:last]])
        yy2 = np.minimum(y2[i], y2[indices[:last]])
        
        # Calculate overlap ratio
        w = np.maximum(0, xx2 - xx1 + 1)
        h = np.maximum(0, yy2 - yy1 + 1)
        overlap = (w * h) / areas[indices[:last]]
        
        # Remove boxes with high overlap
        indices = np.delete(indices, np.concatenate(([last], np.where(overlap > overlap_thresh)[0])))
    
    # Convert back to (top, right, bottom, left) format
    result = []
    for i in picked:
        x, y, w, h = boxes[i]
        top = y
        right = x + w
        bottom = y + h
        left = x
        result.append((top, right, bottom, left))
    
    return result


def _image_to_embedding(image: Image.Image) -> np.ndarray:
    """
    Generate a pseudo-embedding from image features.
    
    This uses image statistics and a hash-based approach for demo purposes.
    For production, use a proper face embedding model (e.g., FaceNet, ArcFace).
    """
    # Resize to standard size
    img_resized = image.resize((64, 64))
    img_array = np.array(img_resized, dtype=np.float32) / 255.0
    
    # Extract features from image
    features = []
    
    # Mean and std per channel
    for c in range(3):
        features.append(img_array[:, :, c].mean())
        features.append(img_array[:, :, c].std())
    
    # Spatial features (divide into grid)
    grid_size = 4
    h, w = img_array.shape[:2]
    gh, gw = h // grid_size, w // grid_size
    for i in range(grid_size):
        for j in range(grid_size):
            cell = img_array[i*gh:(i+1)*gh, j*gw:(j+1)*gw]
            features.append(cell.mean())
    
    # Histogram features
    for c in range(3):
        hist, _ = np.histogram(img_array[:, :, c].flatten(), bins=8, range=(0, 1))
        features.extend(hist / hist.sum())
    
    # Hash-based features for uniqueness
    img_bytes = img_resized.tobytes()
    hash_bytes = hashlib.sha256(img_bytes).digest()
    hash_features = [b / 255.0 for b in hash_bytes[:32]]
    features.extend(hash_features)
    
    # Pad or truncate to EMBEDDING_SIZE
    embedding = np.array(features[:EMBEDDING_SIZE], dtype=np.float64)
    if len(embedding) < EMBEDDING_SIZE:
        embedding = np.pad(embedding, (0, EMBEDDING_SIZE - len(embedding)))
    
    # Normalize
    norm = np.linalg.norm(embedding)
    if norm > 0:
        embedding = embedding / norm
    
    return embedding


def encode_faces(image: Image.Image, face_locations: Optional[List] = None) -> List[np.ndarray]:
    """
    Generate face encodings for faces in an image.
    
    Returns list of numpy arrays, one per detected face.
    """
    if face_locations is None:
        face_locations = detect_faces(image)
    
    encodings = []
    for (top, right, bottom, left) in face_locations:
        # Crop face region
        face_img = image.crop((left, top, right, bottom))
        encoding = _image_to_embedding(face_img)
        encodings.append(encoding)
    
    return encodings


def encoding_to_bytes(encoding: np.ndarray) -> bytes:
    """Convert a face encoding numpy array to bytes for database storage."""
    return encoding.astype(np.float64).tobytes()


def bytes_to_encoding(data: bytes) -> np.ndarray:
    """Convert stored bytes back to a face encoding numpy array."""
    return np.frombuffer(data, dtype=np.float64)


def compare_faces(
    known_encodings: List[np.ndarray],
    face_to_check: np.ndarray,
    tolerance: Optional[float] = None,
) -> Tuple[bool, float]:
    """
    Compare a face encoding against a list of known encodings.
    
    Uses cosine similarity for comparison.
    Returns (matched: bool, confidence: float).
    """
    if tolerance is None:
        tolerance = settings.FACE_RECOGNITION_TOLERANCE
    
    if not known_encodings:
        return False, 0.0
    
    # Calculate cosine similarities
    similarities = []
    for known in known_encodings:
        sim = 1 - cosine(known, face_to_check)
        similarities.append(sim)
    
    best_similarity = max(similarities)
    
    # Convert tolerance (distance-based) to similarity threshold
    # tolerance of 0.6 means distance <= 0.6, so similarity >= 0.4
    similarity_threshold = 1 - tolerance
    matched = best_similarity >= similarity_threshold
    
    # Confidence is the similarity score
    confidence = max(0.0, min(1.0, best_similarity))
    
    return matched, confidence


def extract_and_encode_face(image_base64: str) -> Tuple[Optional[np.ndarray], str]:
    """
    Extract and encode a face from a base64 image.
    
    Returns (encoding, message).
    If no face or multiple faces found, returns (None, error_message).
    """
    try:
        image = decode_base64_image(image_base64)
    except Exception as e:
        return None, f"Failed to decode image: {str(e)}"
    
    face_locations = detect_faces(image)
    
    if len(face_locations) == 0:
        return None, "No face detected in image"
    
    if len(face_locations) > 1:
        return None, f"Multiple faces detected ({len(face_locations)}). Please provide an image with a single face."
    
    encodings = encode_faces(image, face_locations)
    if not encodings:
        return None, "Failed to generate face encoding"
    
    return encodings[0], "Success"


def extract_all_faces(image_base64: str) -> Tuple[List[Tuple[np.ndarray, Tuple[int, int, int, int]]], str]:
    """
    Extract and encode ALL faces from a base64 image (for live recognition).
    
    Returns (list of (encoding, face_location) tuples, message).
    Each face_location is (top, right, bottom, left) for drawing bounding boxes.
    Used by lecturers during live sessions to detect multiple students.
    Uses OpenCV Haar cascade for accurate face-only detection.
    """
    try:
        image = decode_base64_image(image_base64)
    except Exception as e:
        return [], f"Failed to decode image: {str(e)}"
    
    width, height = image.size
    
    if width < 50 or height < 50:
        return [], "Image too small"
    
    # Detect faces using OpenCV Haar cascade - only detects actual faces
    face_locations = detect_faces(image)
    
    if len(face_locations) == 0:
        return [], "No faces detected"
    
    # Return encodings paired with their face locations for bounding box display
    encodings = encode_faces(image, face_locations)
    results = list(zip(encodings, face_locations))
    return results, f"Detected {len(results)} face(s)"


def match_face_to_students(
    face_encoding: np.ndarray,
    student_encodings: List[Tuple[int, str, List[np.ndarray]]],
    tolerance: Optional[float] = None,
) -> Optional[Tuple[int, str, float]]:
    """
    Match a single face encoding against a list of students' encodings.
    
    Args:
        face_encoding: The encoding to match
        student_encodings: List of (student_id, student_name, [encodings])
    
    Returns:
        (student_id, student_name, confidence) if matched, None otherwise
    """
    if tolerance is None:
        tolerance = settings.FACE_RECOGNITION_TOLERANCE
    
    best_match = None
    best_confidence = 0.0
    
    for student_id, student_name, encodings in student_encodings:
        if not encodings:
            continue
        
        matched, confidence = compare_faces(encodings, face_encoding, tolerance)
        if matched and confidence > best_confidence:
            best_match = (student_id, student_name, confidence)
            best_confidence = confidence
    
    return best_match

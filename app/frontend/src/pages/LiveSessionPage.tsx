import { useState, useRef, useCallback, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Webcam from 'react-webcam'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getLiveSessionState,
  getLiveAttendance,
  recognizeFrame,
  pauseSession,
  resumeSession,
  endSession,
} from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { Progress } from '@/components/ui/progress'
import {
  Camera,
  Pause,
  Play,
  Square,
  CheckCircle,
  XCircle,
  Clock,
  Users,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Wifi,
} from 'lucide-react'

interface LiveSessionState {
  session_id: number
  status: 'scheduled' | 'active' | 'paused' | 'ended'
  title: string
  module_code: string
  module_name: string
  actual_start: string | null
  total_enrolled: number
  present_count: number
  late_count: number
  absent_count: number
}

interface LiveAttendanceStudent {
  student_id: number
  student_name: string
  username: string
  status: 'present' | 'absent' | 'late'
  marked_at: string | null
  face_confidence: number | null
  has_face_registered: boolean
}

interface FaceBox {
  top: number
  right: number
  bottom: number
  left: number
}

interface RecognizedStudent {
  student_id: number | null
  student_name: string | null
  username: string | null
  confidence: number
  status: 'present' | 'late' | null
  already_marked: boolean
  face_box: FaceBox | null
  is_unknown?: boolean
}

const statusIcons = {
  present: <CheckCircle className="h-4 w-4 text-green-500" />,
  late: <Clock className="h-4 w-4 text-yellow-500" />,
  absent: <XCircle className="h-4 w-4 text-red-500" />,
}

const statusColors: Record<string, 'success' | 'warning' | 'destructive' | 'secondary'> = {
  present: 'success',
  late: 'warning',
  absent: 'destructive',
}

export default function LiveSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const webcamRef = useRef<Webcam>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  const [isRecognizing, setIsRecognizing] = useState(false)
  const [lastRecognized, setLastRecognized] = useState<RecognizedStudent[]>([])
  const [frameCount, setFrameCount] = useState(0)
  const [cameraSource, setCameraSource] = useState<'macbook' | 'esp32'>('macbook')
  const [esp32IP, setEsp32IP] = useState('192.168.0.182')
  const [esp32Status, setEsp32Status] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle')
  const esp32CanvasRef = useRef<HTMLCanvasElement>(null)
  const esp32ActiveRef = useRef(false)
  const latestFrameRef = useRef<ImageBitmap | null>(null)

  // Servo tracking state
  const panRef = useRef(90)
  const tiltRef = useRef(90)

  // Draw face bounding boxes on canvas overlay
  const drawFaceBoxes = useCallback((students: RecognizedStudent[]) => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Get display element and source dimensions based on camera source
    let displayEl: HTMLElement | null = null
    let sourceWidth = 640
    let sourceHeight = 480

    if (cameraSource === 'esp32') {
      displayEl = esp32CanvasRef.current
      sourceWidth = 320
      sourceHeight = 240
    } else {
      displayEl = webcamRef.current?.video || null
    }

    if (!displayEl) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Match canvas size to display element size
    const displayRect = displayEl.getBoundingClientRect()
    canvas.width = displayRect.width
    canvas.height = displayRect.height

    // Clear previous drawings
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Calculate scale factors (source capture size vs display size)
    const scaleX = displayRect.width / sourceWidth
    const scaleY = displayRect.height / sourceHeight

    students.forEach((student) => {
      if (!student.face_box) return

      const { top, right, bottom, left } = student.face_box
      
      // Scale coordinates to match displayed size
      const x = left * scaleX
      const y = top * scaleY
      const width = (right - left) * scaleX
      const height = (bottom - top) * scaleY

      const isUnknown = student.is_unknown === true

      // Draw rectangle — red for unknown, green for matched
      ctx.strokeStyle = isUnknown ? '#ef4444' : '#22c55e'
      ctx.lineWidth = 3
      ctx.strokeRect(x, y, width, height)

      // Draw label background
      const label = isUnknown ? 'Unknown' : `${student.student_name} (@${student.username})`
      const confidence = isUnknown ? '' : `${Math.round(student.confidence * 100)}%`
      ctx.font = 'bold 14px Inter, system-ui, sans-serif'
      const labelWidth = Math.max(ctx.measureText(label).width, ctx.measureText(confidence).width) + 16
      const labelHeight = isUnknown ? 28 : 44

      ctx.fillStyle = isUnknown ? 'rgba(239, 68, 68, 0.9)' : 'rgba(34, 197, 94, 0.9)'
      ctx.fillRect(x, y - labelHeight, labelWidth, labelHeight)

      // Draw text
      ctx.fillStyle = '#ffffff'
      if (isUnknown) {
        ctx.fillText(label, x + 8, y - 8)
      } else {
        ctx.fillText(label, x + 8, y - 26)
        ctx.font = '12px Inter, system-ui, sans-serif'
        ctx.fillText(confidence, x + 8, y - 8)
      }
    })
  }, [cameraSource])
  
  const sessionIdNum = parseInt(sessionId || '0')

  // Fetch session state
  const { data: sessionState, isLoading: stateLoading } = useQuery<LiveSessionState>({
    queryKey: ['live-session-state', sessionIdNum],
    queryFn: () => getLiveSessionState(sessionIdNum),
    refetchInterval: 3000, // Refresh every 3 seconds
    enabled: sessionIdNum > 0,
  })

  // Fetch attendance list
  const { data: attendanceData } = useQuery<{ session_id: number; students: LiveAttendanceStudent[] }>({
    queryKey: ['live-attendance', sessionIdNum],
    queryFn: () => getLiveAttendance(sessionIdNum),
    refetchInterval: 2000, // Refresh every 2 seconds
    enabled: sessionIdNum > 0,
  })

  // Recognition mutation
  const recognizeMutation = useMutation({
    mutationFn: (imageBase64: string) => recognizeFrame(sessionIdNum, imageBase64),
    onSuccess: (data) => {
      if (data.recognized_students && data.recognized_students.length > 0) {
        setLastRecognized(data.recognized_students)
        // Draw bounding boxes around recognized faces
        drawFaceBoxes(data.recognized_students)
        const newlyMarked = data.recognized_students.filter((s: RecognizedStudent) => !s.already_marked && !s.is_unknown)
        if (newlyMarked.length > 0) {
          toast({
            title: `Recognized ${newlyMarked.length} student(s)`,
            description: newlyMarked.map((s: RecognizedStudent) => s.student_name).join(', '),
          })
        }
        queryClient.invalidateQueries({ queryKey: ['live-attendance', sessionIdNum] })
        queryClient.invalidateQueries({ queryKey: ['live-session-state', sessionIdNum] })

        // Servo tracking — move mount toward detected face (ESP32 only)
        if (cameraSource === 'esp32') {
          const face = data.recognized_students.find((s: RecognizedStudent) => s.face_box)
          if (face && face.face_box) {
            const cx = (face.face_box.left + face.face_box.right) / 2
            const cy = (face.face_box.top + face.face_box.bottom) / 2
            let ex = (cx / 320) - 0.5
            let ey = (cy / 240) - 0.5
            if (Math.abs(ex) < 0.05) ex = 0
            if (Math.abs(ey) < 0.05) ey = 0
            const newPan = Math.max(20, Math.min(160, panRef.current + ex * 30))
            const newTilt = Math.max(30, Math.min(150, tiltRef.current + ey * 30))
            panRef.current = newPan
            tiltRef.current = newTilt
            fetch(`http://${esp32IP}/servo?pan=${Math.round(newPan)}&tilt=${Math.round(newTilt)}`, {
              mode: 'no-cors',
            }).catch(() => {})
          }
        }
      } else {
        // Clear boxes if no faces recognized
        const canvas = canvasRef.current
        if (canvas) {
          const ctx = canvas.getContext('2d')
          if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
        }
      }
      setFrameCount(prev => prev + 1)
    },
  })

  // Session control mutations
  const pauseMutation = useMutation({
    mutationFn: () => pauseSession(sessionIdNum),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['live-session-state', sessionIdNum] })
      toast({ title: 'Recognition paused' })
    },
  })

  const resumeMutation = useMutation({
    mutationFn: () => resumeSession(sessionIdNum),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['live-session-state', sessionIdNum] })
      toast({ title: 'Recognition resumed' })
    },
  })

  const endMutation = useMutation({
    mutationFn: () => endSession(sessionIdNum),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      toast({ title: 'Session ended' })
      navigate('/sessions')
    },
  })

  // Capture and recognize frame
  const captureAndRecognize = useCallback(() => {
    if (!webcamRef.current || recognizeMutation.isPending) return
    
    const imageSrc = webcamRef.current.getScreenshot()
    if (imageSrc) {
      recognizeMutation.mutate(imageSrc)
    }
  }, [recognizeMutation])

  // Capture frame from ESP32 for recognition (reuses latest frame from display loop)
  const captureEsp32Frame = useCallback(() => {
    if (recognizeMutation.isPending) return

    const bitmap = latestFrameRef.current
    if (!bitmap) return

    const offscreen = document.createElement('canvas')
    offscreen.width = bitmap.width
    offscreen.height = bitmap.height
    const ctx = offscreen.getContext('2d')
    if (!ctx) return
    ctx.drawImage(bitmap, 0, 0)
    const base64 = offscreen.toDataURL('image/jpeg', 0.85)
    recognizeMutation.mutate(base64)
  }, [recognizeMutation])

  // Connect to ESP32 — fetch first frame to verify reachability
  const connectToEsp32 = useCallback(async () => {
    setEsp32Status('connecting')
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    try {
      const response = await fetch(`http://${esp32IP}/jpg`, {
        cache: 'no-store',
        signal: controller.signal,
      })
      clearTimeout(timeout)
      const blob = await response.blob()
      const bitmap = await createImageBitmap(blob)
      latestFrameRef.current = bitmap
      const canvas = esp32CanvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        canvas.width = bitmap.width
        canvas.height = bitmap.height
        ctx?.drawImage(bitmap, 0, 0)
      }
      setEsp32Status('connected')
    } catch (err) {
      clearTimeout(timeout)
      setEsp32Status('error')
    }
  }, [esp32IP])

  // ESP32 frame fetch loop — single connection, stores frames in latestFrameRef
  useEffect(() => {
    if (cameraSource !== 'esp32' || esp32Status !== 'connected') {
      esp32ActiveRef.current = false
      latestFrameRef.current = null
      return
    }

    esp32ActiveRef.current = true

    const fetchLoop = async () => {
      while (esp32ActiveRef.current) {
        try {
          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), 800)
          const response = await fetch(`http://${esp32IP}/jpg`, {
            cache: 'no-store',
            signal: controller.signal,
          })
          clearTimeout(timeout)
          const blob = await response.blob()
          const bitmap = await createImageBitmap(blob)
          latestFrameRef.current = bitmap
        } catch {
          await new Promise(r => setTimeout(r, 50))
        }
      }
    }

    fetchLoop()

    return () => {
      esp32ActiveRef.current = false
    }
  }, [cameraSource, esp32Status, esp32IP])

  // ESP32 canvas render loop — draws latest frame at display refresh rate
  useEffect(() => {
    if (cameraSource !== 'esp32' || esp32Status !== 'connected') return

    let animId: number
    const render = () => {
      const bitmap = latestFrameRef.current
      const canvas = esp32CanvasRef.current
      if (bitmap && canvas) {
        const ctx = canvas.getContext('2d')
        if (ctx) {
          if (canvas.width !== bitmap.width || canvas.height !== bitmap.height) {
            canvas.width = bitmap.width
            canvas.height = bitmap.height
          }
          ctx.drawImage(bitmap, 0, 0)
        }
      }
      animId = requestAnimationFrame(render)
    }

    animId = requestAnimationFrame(render)
    return () => cancelAnimationFrame(animId)
  }, [cameraSource, esp32Status])

  // Auto-capture every 200ms (5 FPS) for real-time detection of walking students
  useEffect(() => {
    if (!isRecognizing || sessionState?.status !== 'active') return

    const captureFn = cameraSource === 'esp32' ? captureEsp32Frame : captureAndRecognize
    const interval = setInterval(captureFn, 200)
    return () => clearInterval(interval)
  }, [isRecognizing, sessionState?.status, cameraSource, captureAndRecognize, captureEsp32Frame])

  // Clear canvas when recognition stops
  useEffect(() => {
    if (!isRecognizing) {
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
    }
  }, [isRecognizing])

  if (stateLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!sessionState) {
    return (
      <div className="space-y-6">
        <Card className="p-8 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
          <h3 className="mt-4 font-semibold">Session not found</h3>
          <Button className="mt-4" onClick={() => navigate('/sessions')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Sessions
          </Button>
        </Card>
      </div>
    )
  }

  const attendedCount = sessionState.present_count + sessionState.late_count
  const attendanceRate = sessionState.total_enrolled > 0 
    ? Math.round((attendedCount / sessionState.total_enrolled) * 100) 
    : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/sessions')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{sessionState.title}</h1>
            <p className="text-muted-foreground">
              {sessionState.module_code} - {sessionState.module_name}
            </p>
          </div>
        </div>
        <Badge
          variant={
            sessionState.status === 'active' ? 'success' :
            sessionState.status === 'paused' ? 'warning' : 'secondary'
          }
          className="text-sm"
        >
          {sessionState.status.toUpperCase()}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Camera Feed */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Live Camera Feed
              </CardTitle>
              <div className="flex items-center gap-2">
                {sessionState.status === 'active' && (
                  <Button
                    variant={isRecognizing ? 'destructive' : 'default'}
                    size="sm"
                    onClick={() => setIsRecognizing(!isRecognizing)}
                  >
                    {isRecognizing ? (
                      <>
                        <Square className="mr-1 h-4 w-4" />
                        Stop Recognition
                      </>
                    ) : (
                      <>
                        <Play className="mr-1 h-4 w-4" />
                        Start Recognition
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
            <CardDescription>
              {isRecognizing 
                ? `Processing frames via ${cameraSource === 'esp32' ? 'ESP32' : 'MacBook'} camera... (${frameCount} processed)` 
                : 'Select a camera source and click Start Recognition'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Camera Source Selector — visible before recognition starts */}
            {sessionState.status === 'active' && !isRecognizing && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Button
                    variant={cameraSource === 'macbook' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setCameraSource('macbook')
                      setEsp32Status('idle')
                    }}
                  >
                    MacBook Camera
                  </Button>
                  <Button
                    variant={cameraSource === 'esp32' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setCameraSource('esp32')
                      connectToEsp32()
                    }}
                  >
                    ESP32 Camera
                  </Button>
                </div>
                {cameraSource === 'esp32' && (
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground whitespace-nowrap">ESP32 IP:</label>
                    <Input
                      value={esp32IP}
                      onChange={(e) => setEsp32IP(e.target.value)}
                      placeholder="192.168.0.182"
                      className="max-w-[200px] h-8 text-sm"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => connectToEsp32()}
                      disabled={esp32Status === 'connecting'}
                    >
                      {esp32Status === 'connecting' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Connect'
                      )}
                    </Button>
                    {esp32Status === 'connected' && (
                      <Badge variant="success" className="text-xs">Connected</Badge>
                    )}
                  </div>
                )}
              </div>
            )}
            {/* Source label — visible while recognition is active */}
            {isRecognizing && (
              <Badge variant="outline" className="text-xs">
                {cameraSource === 'esp32' ? (
                  <><Wifi className="mr-1 h-3 w-3" /> ESP32 ({esp32IP})</>
                ) : (
                  <><Camera className="mr-1 h-3 w-3" /> MacBook Camera</>
                )}
              </Badge>
            )}

            <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
              {cameraSource === 'macbook' ? (
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  screenshotFormat="image/jpeg"
                  videoConstraints={{ facingMode: 'user', width: 640, height: 480 }}
                  className="h-full w-full object-cover"
                />
              ) : (
                <>
                  <canvas
                    ref={esp32CanvasRef}
                    className="h-full w-full object-cover"
                  />
                  {esp32Status === 'connecting' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-muted">
                      <div className="text-center">
                        <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
                        <p className="mt-2 text-sm text-muted-foreground">Connecting to ESP32...</p>
                      </div>
                    </div>
                  )}
                  {esp32Status === 'error' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-muted">
                      <div className="text-center space-y-3">
                        <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
                        <p className="text-sm text-destructive font-medium">
                          Cannot reach ESP32 at {esp32IP}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Check the IP address and ensure ESP32 is powered.
                        </p>
                        <Button size="sm" variant="outline" onClick={() => connectToEsp32()}>
                          Retry
                        </Button>
                      </div>
                    </div>
                  )}
                  {esp32Status === 'idle' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-muted">
                      <div className="text-center">
                        <Wifi className="mx-auto h-8 w-8 text-muted-foreground" />
                        <p className="mt-2 text-sm text-muted-foreground">Select ESP32 Camera to connect</p>
                      </div>
                    </div>
                  )}
                </>
              )}
              {/* Canvas overlay for drawing face bounding boxes */}
              <canvas
                ref={canvasRef}
                className="absolute inset-0 h-full w-full pointer-events-none"
              />
              {isRecognizing && sessionState.status === 'active' && (
                <div className="absolute top-2 right-2 flex items-center gap-2 rounded-full bg-red-500 px-3 py-1 text-xs text-white">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                  LIVE
                </div>
              )}
              {sessionState.status === 'paused' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <div className="text-center text-white">
                    <Pause className="mx-auto h-12 w-12" />
                    <p className="mt-2 font-medium">Recognition Paused</p>
                  </div>
                </div>
              )}
            </div>

            {/* Session Controls */}
            <div className="flex gap-2">
              {sessionState.status === 'active' && (
                <Button
                  variant="outline"
                  onClick={() => pauseMutation.mutate()}
                  disabled={pauseMutation.isPending}
                >
                  <Pause className="mr-2 h-4 w-4" />
                  Pause Session
                </Button>
              )}
              {sessionState.status === 'paused' && (
                <Button
                  onClick={() => resumeMutation.mutate()}
                  disabled={resumeMutation.isPending}
                >
                  <Play className="mr-2 h-4 w-4" />
                  Resume Session
                </Button>
              )}
              {(sessionState.status === 'active' || sessionState.status === 'paused') && (
                <Button
                  variant="destructive"
                  onClick={() => endMutation.mutate()}
                  disabled={endMutation.isPending}
                >
                  <Square className="mr-2 h-4 w-4" />
                  End Session
                </Button>
              )}
            </div>

            {/* Last Recognized */}
            {lastRecognized.length > 0 && (
              <div className="rounded-lg border bg-muted/50 p-4">
                <h4 className="font-medium mb-2">Last Recognized</h4>
                <div className="flex flex-wrap gap-2">
                  {lastRecognized.map((student, idx) => (
                    <Badge
                      key={student.is_unknown ? `unknown-${idx}` : student.student_id}
                      variant={student.is_unknown ? 'destructive' : student.already_marked ? 'secondary' : 'success'}
                    >
                      {student.is_unknown ? 'Unknown' : student.student_name}
                      {!student.is_unknown && (
                        <span className="ml-1 opacity-70">
                          ({Math.round(student.confidence * 100)}%)
                        </span>
                      )}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Attendance Stats & List */}
        <div className="space-y-6">
          {/* Stats */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Attendance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Attendance Rate</span>
                  <span className="font-medium">{attendanceRate}%</span>
                </div>
                <Progress value={attendanceRate} />
              </div>
              
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-green-50 p-3 dark:bg-green-950">
                  <p className="text-2xl font-bold text-green-600">{sessionState.present_count}</p>
                  <p className="text-xs text-muted-foreground">Present</p>
                </div>
                <div className="rounded-lg bg-yellow-50 p-3 dark:bg-yellow-950">
                  <p className="text-2xl font-bold text-yellow-600">{sessionState.late_count}</p>
                  <p className="text-xs text-muted-foreground">Late</p>
                </div>
                <div className="rounded-lg bg-red-50 p-3 dark:bg-red-950">
                  <p className="text-2xl font-bold text-red-600">{sessionState.absent_count}</p>
                  <p className="text-xs text-muted-foreground">Absent</p>
                </div>
              </div>
              
              <p className="text-sm text-muted-foreground text-center">
                {attendedCount} of {sessionState.total_enrolled} students
              </p>
            </CardContent>
          </Card>

          {/* Student List */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Student List</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-[400px] overflow-y-auto space-y-2">
                {attendanceData?.students.map((student) => (
                  <div
                    key={student.student_id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-2">
                      {statusIcons[student.status]}
                      <div>
                        <p className="font-medium text-sm">{student.student_name}</p>
                        <p className="text-xs text-muted-foreground">@{student.username}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!student.has_face_registered && (
                        <Badge variant="outline" className="text-xs">No Face</Badge>
                      )}
                      <Badge variant={statusColors[student.status]} className="text-xs">
                        {student.status}
                      </Badge>
                    </div>
                  </div>
                ))}
                {(!attendanceData?.students || attendanceData.students.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No students enrolled
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getSessions, startSession, pauseSession, resumeSession, endSession, createSession, deleteSession, getModules } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { Calendar, Play, Pause, Square, Clock, Video, Plus, Trash2 } from 'lucide-react'
import { format } from 'date-fns'

interface Session {
  id: number
  module_id: number
  title: string
  scheduled_start: string
  scheduled_end: string
  actual_start: string | null
  actual_end: string | null
  status: 'scheduled' | 'active' | 'paused' | 'ended'
  late_threshold_minutes: number
  created_at: string
}

interface Module {
  id: number
  code: string
  name: string
}

const statusColors: Record<string, 'default' | 'success' | 'warning' | 'secondary'> = {
  scheduled: 'secondary',
  active: 'success',
  paused: 'warning',
  ended: 'default',
}

export default function SessionsPage() {
  const { user } = useAuthStore()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [formData, setFormData] = useState({
    module_id: '',
    title: '',
    scheduled_start: '',
    scheduled_end: '',
    late_threshold_minutes: '15',
  })

  const { data: sessions, isLoading } = useQuery<Session[]>({
    queryKey: ['sessions'],
    queryFn: () => getSessions(),
  })

  const { data: modules } = useQuery<Module[]>({
    queryKey: ['modules'],
    queryFn: getModules,
    enabled: user?.role === 'lecturer' || user?.role === 'admin',
  })

  const startMutation = useMutation({
    mutationFn: startSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      toast({ title: 'Session started' })
    },
    onError: (error: any) => {
      const message = error?.response?.data?.detail || 'Failed to start session'
      toast({ variant: 'destructive', title: 'Error', description: message })
    },
  })

  const pauseMutation = useMutation({
    mutationFn: pauseSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      toast({ title: 'Session paused' })
    },
    onError: (error: any) => {
      const message = error?.response?.data?.detail || 'Failed to pause session'
      toast({ variant: 'destructive', title: 'Error', description: message })
    },
  })

  const resumeMutation = useMutation({
    mutationFn: resumeSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      toast({ title: 'Session resumed' })
    },
    onError: (error: any) => {
      const message = error?.response?.data?.detail || 'Failed to resume session'
      toast({ variant: 'destructive', title: 'Error', description: message })
    },
  })

  const endMutation = useMutation({
    mutationFn: endSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      toast({ title: 'Session ended' })
    },
    onError: (error: any) => {
      const message = error?.response?.data?.detail || 'Failed to end session'
      toast({ variant: 'destructive', title: 'Error', description: message })
    },
  })

  const createMutation = useMutation({
    mutationFn: createSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      toast({ title: 'Session scheduled successfully' })
      setIsCreateOpen(false)
      resetForm()
    },
    onError: (error: any) => {
      const message = error?.response?.data?.detail || 'Failed to create session'
      toast({ variant: 'destructive', title: 'Error', description: message })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      toast({ title: 'Session deleted' })
    },
    onError: (error: any) => {
      const message = error?.response?.data?.detail || 'Failed to delete session'
      toast({ variant: 'destructive', title: 'Error', description: message })
    },
  })

  const canManageSessions = user?.role === 'lecturer' || user?.role === 'admin'

  const resetForm = () => {
    setFormData({
      module_id: '',
      title: '',
      scheduled_start: '',
      scheduled_end: '',
      late_threshold_minutes: '15',
    })
  }

  const handleCreate = () => {
    createMutation.mutate({
      module_id: parseInt(formData.module_id),
      title: formData.title,
      scheduled_start: new Date(formData.scheduled_start).toISOString(),
      scheduled_end: new Date(formData.scheduled_end).toISOString(),
      late_threshold_minutes: parseInt(formData.late_threshold_minutes),
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sessions</h1>
          <p className="text-muted-foreground">
            View and manage class sessions
          </p>
        </div>
        {canManageSessions && (
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Schedule Session
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-5 w-32 rounded bg-muted" />
              </CardHeader>
              <CardContent>
                <div className="h-4 w-48 rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : sessions && sessions.length > 0 ? (
        <div className="space-y-4">
          {sessions.map((session) => (
            <Card key={session.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{session.title}</CardTitle>
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <Clock className="h-4 w-4" />
                      {format(new Date(session.scheduled_start), 'PPp')}
                    </p>
                  </div>
                  <Badge variant={statusColors[session.status]}>
                    {session.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Late threshold: {session.late_threshold_minutes} min
                  </p>
                  {canManageSessions && (
                    <div className="flex gap-2">
                      {session.status === 'scheduled' && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => startMutation.mutate(session.id)}
                            disabled={startMutation.isPending}
                          >
                            <Play className="mr-1 h-4 w-4" />
                            Start
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => deleteMutation.mutate(session.id)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {session.status === 'active' && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => navigate(`/live-session/${session.id}`)}
                          >
                            <Video className="mr-1 h-4 w-4" />
                            Live
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => pauseMutation.mutate(session.id)}
                            disabled={pauseMutation.isPending}
                          >
                            <Pause className="mr-1 h-4 w-4" />
                            Pause
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => endMutation.mutate(session.id)}
                            disabled={endMutation.isPending}
                          >
                            <Square className="mr-1 h-4 w-4" />
                            End
                          </Button>
                        </>
                      )}
                      {session.status === 'paused' && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => resumeMutation.mutate(session.id)}
                            disabled={resumeMutation.isPending}
                          >
                            <Play className="mr-1 h-4 w-4" />
                            Resume
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => endMutation.mutate(session.id)}
                            disabled={endMutation.isPending}
                          >
                            <Square className="mr-1 h-4 w-4" />
                            End
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center">
          <Calendar className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 font-semibold">No sessions found</h3>
          <p className="text-sm text-muted-foreground">
            No sessions have been scheduled yet.
          </p>
        </Card>
      )}

      {/* Create Session Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule New Session</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="module">Module</Label>
              <select
                id="module"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formData.module_id}
                onChange={(e) => setFormData({ ...formData, module_id: e.target.value })}
              >
                <option value="">Select a module</option>
                {modules?.map((m) => (
                  <option key={m.id} value={m.id}>{m.code} - {m.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Session Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Week 1 Lecture"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="start">Start Date & Time</Label>
              <Input
                id="start"
                type="datetime-local"
                value={formData.scheduled_start}
                onChange={(e) => setFormData({ ...formData, scheduled_start: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end">End Date & Time</Label>
              <Input
                id="end"
                type="datetime-local"
                value={formData.scheduled_end}
                onChange={(e) => setFormData({ ...formData, scheduled_end: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="threshold">Late Threshold (minutes)</Label>
              <Input
                id="threshold"
                type="number"
                value={formData.late_threshold_minutes}
                onChange={(e) => setFormData({ ...formData, late_threshold_minutes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsCreateOpen(false); resetForm() }}>Cancel</Button>
            <Button 
              onClick={handleCreate} 
              disabled={createMutation.isPending || !formData.module_id || !formData.title || !formData.scheduled_start || !formData.scheduled_end}
            >
              Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

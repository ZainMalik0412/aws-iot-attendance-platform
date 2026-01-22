import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getModules, getUsers, createModule, updateModule, deleteModule, enrolStudent, unenrolStudent, getModuleStudents } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { BookOpen, Users, Plus, Pencil, Trash2, UserPlus, UserMinus } from 'lucide-react'

interface Module {
  id: number
  code: string
  name: string
  description: string | null
  lecturer_id: number | null
  created_at: string
}

interface User {
  id: number
  username: string
  full_name: string
  role: string
}

export default function ModulesPage() {
  const { user } = useAuthStore()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isStudentsOpen, setIsStudentsOpen] = useState(false)
  const [selectedModule, setSelectedModule] = useState<Module | null>(null)
  const [formData, setFormData] = useState({ code: '', name: '', description: '', lecturer_id: '' })

  const { data: modules, isLoading } = useQuery<Module[]>({
    queryKey: ['modules'],
    queryFn: getModules,
  })

  const { data: lecturers } = useQuery<User[]>({
    queryKey: ['users', 'lecturer'],
    queryFn: () => getUsers('lecturer'),
    enabled: user?.role === 'admin',
  })

  const { data: allStudents } = useQuery<User[]>({
    queryKey: ['users', 'student'],
    queryFn: () => getUsers('student'),
    enabled: user?.role === 'admin' && isStudentsOpen,
  })

  const { data: enrolledStudents, refetch: refetchEnrolled } = useQuery<User[]>({
    queryKey: ['module-students', selectedModule?.id],
    queryFn: () => getModuleStudents(selectedModule!.id),
    enabled: !!selectedModule && isStudentsOpen,
  })

  const createMutation = useMutation({
    mutationFn: createModule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modules'] })
      toast({ title: 'Module created successfully' })
      setIsCreateOpen(false)
      resetForm()
    },
    onError: (error: any) => {
      const message = error?.response?.data?.detail || 'Failed to create module'
      toast({ variant: 'destructive', title: 'Error', description: message })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof updateModule>[1] }) => updateModule(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modules'] })
      toast({ title: 'Module updated successfully' })
      setIsEditOpen(false)
      resetForm()
    },
    onError: (error: any) => {
      const message = error?.response?.data?.detail || 'Failed to update module'
      toast({ variant: 'destructive', title: 'Error', description: message })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteModule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modules'] })
      toast({ title: 'Module deleted successfully' })
    },
    onError: (error: any) => {
      const message = error?.response?.data?.detail || 'Failed to delete module'
      toast({ variant: 'destructive', title: 'Error', description: message })
    },
  })

  const enrolMutation = useMutation({
    mutationFn: ({ studentId, moduleId }: { studentId: number; moduleId: number }) => enrolStudent(studentId, moduleId),
    onSuccess: () => {
      refetchEnrolled()
      toast({ title: 'Student enrolled successfully' })
    },
    onError: (error: any) => {
      const message = error?.response?.data?.detail || 'Failed to enrol student'
      toast({ variant: 'destructive', title: 'Error', description: message })
    },
  })

  const unenrolMutation = useMutation({
    mutationFn: ({ studentId, moduleId }: { studentId: number; moduleId: number }) => unenrolStudent(studentId, moduleId),
    onSuccess: () => {
      refetchEnrolled()
      toast({ title: 'Student unenrolled successfully' })
    },
    onError: (error: any) => {
      const message = error?.response?.data?.detail || 'Failed to unenrol student'
      toast({ variant: 'destructive', title: 'Error', description: message })
    },
  })

  const resetForm = () => {
    setFormData({ code: '', name: '', description: '', lecturer_id: '' })
    setSelectedModule(null)
  }

  const handleCreate = () => {
    createMutation.mutate({
      code: formData.code,
      name: formData.name,
      description: formData.description || undefined,
      lecturer_id: formData.lecturer_id ? parseInt(formData.lecturer_id) : undefined,
    })
  }

  const handleUpdate = () => {
    if (!selectedModule) return
    updateMutation.mutate({
      id: selectedModule.id,
      data: {
        code: formData.code,
        name: formData.name,
        description: formData.description,
        lecturer_id: formData.lecturer_id ? parseInt(formData.lecturer_id) : undefined,
      },
    })
  }

  const openEdit = (module: Module) => {
    setSelectedModule(module)
    setFormData({
      code: module.code,
      name: module.name,
      description: module.description || '',
      lecturer_id: module.lecturer_id?.toString() || '',
    })
    setIsEditOpen(true)
  }

  const openStudents = (module: Module) => {
    setSelectedModule(module)
    setIsStudentsOpen(true)
  }

  const isAdmin = user?.role === 'admin'
  const enrolledIds = new Set(enrolledStudents?.map(s => s.id) || [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Modules</h1>
          <p className="text-muted-foreground">
            {user?.role === 'student'
              ? 'Modules you are enrolled in'
              : user?.role === 'lecturer'
              ? 'Modules you teach'
              : 'All modules in the system'}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Module
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-5 w-20 rounded bg-muted" />
                <div className="h-4 w-32 rounded bg-muted" />
              </CardHeader>
              <CardContent>
                <div className="h-4 w-full rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : modules && modules.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((module) => (
            <Card key={module.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <Badge variant="outline">{module.code}</Badge>
                  <BookOpen className="h-5 w-5 text-muted-foreground" />
                </div>
                <CardTitle className="text-lg">{module.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                  {module.description || 'No description available'}
                </p>
                {isAdmin && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(module)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openStudents(module)}>
                      <Users className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteMutation.mutate(module.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center">
          <Users className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 font-semibold">No modules found</h3>
          <p className="text-sm text-muted-foreground">
            {user?.role === 'student'
              ? 'You are not enrolled in any modules yet.'
              : 'No modules have been created.'}
          </p>
        </Card>
      )}

      {/* Create Module Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Module</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="code">Module Code</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="e.g., CS101"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Module Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Introduction to Computer Science"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Module description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lecturer">Assign Lecturer</Label>
              <select
                id="lecturer"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formData.lecturer_id}
                onChange={(e) => setFormData({ ...formData, lecturer_id: e.target.value })}
              >
                <option value="">No lecturer assigned</option>
                {lecturers?.map((l) => (
                  <option key={l.id} value={l.id}>{l.full_name}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsCreateOpen(false); resetForm() }}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending || !formData.code || !formData.name}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Module Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Module</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-code">Module Code</Label>
              <Input
                id="edit-code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-name">Module Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Input
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-lecturer">Assign Lecturer</Label>
              <select
                id="edit-lecturer"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formData.lecturer_id}
                onChange={(e) => setFormData({ ...formData, lecturer_id: e.target.value })}
              >
                <option value="">No lecturer assigned</option>
                {lecturers?.map((l) => (
                  <option key={l.id} value={l.id}>{l.full_name}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsEditOpen(false); resetForm() }}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Students Dialog */}
      <Dialog open={isStudentsOpen} onOpenChange={setIsStudentsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage Students - {selectedModule?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4 md:grid-cols-2 max-h-96 overflow-y-auto">
            <div>
              <h4 className="font-medium mb-2">Enrolled Students</h4>
              <div className="space-y-2">
                {enrolledStudents?.length ? enrolledStudents.map((student) => (
                  <div key={student.id} className="flex items-center justify-between p-2 border rounded">
                    <span className="text-sm">{student.full_name}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => unenrolMutation.mutate({ studentId: student.id, moduleId: selectedModule!.id })}
                    >
                      <UserMinus className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                )) : <p className="text-sm text-muted-foreground">No students enrolled</p>}
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-2">Available Students</h4>
              <div className="space-y-2">
                {allStudents?.filter(s => !enrolledIds.has(s.id)).map((student) => (
                  <div key={student.id} className="flex items-center justify-between p-2 border rounded">
                    <span className="text-sm">{student.full_name}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => enrolMutation.mutate({ studentId: student.id, moduleId: selectedModule!.id })}
                    >
                      <UserPlus className="h-4 w-4 text-green-500" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export type Locale = 'en' | 'hi' | 'zh' | 'es';

type MessageMap = Record<string, string>;

export const messages: Record<Locale, MessageMap> = {
  en: {
    'mobile.loadingTasks': 'Loading tasks...',
    'mobile.noTasks': 'No tasks in this status',
    'mobile.newTask': 'New Task',
    'mobile.loadingTask': 'Loading task...',
    'mobile.taskNotFound': 'Task not found',
    'mobile.description': 'Description',
    'mobile.details': 'Details',
    'mobile.priority': 'Priority',
    'mobile.dueDate': 'Due Date',
    'mobile.createdBy': 'Created by',
    'mobile.taskDetails': 'Task Details',
    'mobile.editTask': 'Edit Task',
    'mobile.createTask': 'Create Task',
    'mobile.appTitle': 'TaskFlow'
  },
  hi: {
    'mobile.loadingTasks': 'कार्य लोड हो रहे हैं...',
    'mobile.noTasks': 'इस स्थिति में कोई कार्य नहीं है',
    'mobile.newTask': 'नया कार्य',
    'mobile.loadingTask': 'कार्य लोड हो रहा है...',
    'mobile.taskNotFound': 'कार्य नहीं मिला',
    'mobile.description': 'विवरण',
    'mobile.details': 'विवरण',
    'mobile.priority': 'प्राथमिकता',
    'mobile.dueDate': 'नियत तिथि',
    'mobile.createdBy': 'द्वारा बनाया गया',
    'mobile.taskDetails': 'कार्य विवरण',
    'mobile.editTask': 'कार्य संपादित करें',
    'mobile.createTask': 'कार्य बनाएं',
    'mobile.appTitle': 'TaskFlow'
  },
  zh: {
    'mobile.loadingTasks': '正在加载任务...',
    'mobile.noTasks': '该状态下没有任务',
    'mobile.newTask': '新建任务',
    'mobile.loadingTask': '正在加载任务...',
    'mobile.taskNotFound': '未找到任务',
    'mobile.description': '描述',
    'mobile.details': '详情',
    'mobile.priority': '优先级',
    'mobile.dueDate': '截止日期',
    'mobile.createdBy': '创建者',
    'mobile.taskDetails': '任务详情',
    'mobile.editTask': '编辑任务',
    'mobile.createTask': '创建任务',
    'mobile.appTitle': 'TaskFlow'
  },
  es: {
    'mobile.loadingTasks': 'Cargando tareas...',
    'mobile.noTasks': 'No hay tareas en este estado',
    'mobile.newTask': 'Nueva tarea',
    'mobile.loadingTask': 'Cargando tarea...',
    'mobile.taskNotFound': 'Tarea no encontrada',
    'mobile.description': 'Descripcion',
    'mobile.details': 'Detalles',
    'mobile.priority': 'Prioridad',
    'mobile.dueDate': 'Fecha de vencimiento',
    'mobile.createdBy': 'Creado por',
    'mobile.taskDetails': 'Detalles de la tarea',
    'mobile.editTask': 'Editar tarea',
    'mobile.createTask': 'Crear tarea',
    'mobile.appTitle': 'TaskFlow'
  }
};

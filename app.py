from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import os
import requests
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

app = Flask(__name__)

# 配置数据库
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{os.path.join(basedir, "instance", "notes.db")}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# 定义数据模型
class Folder(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    
    notes = db.relationship('Note', backref='folder', lazy=True)

class Note(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200))
    content = db.Column(db.Text)
    tag = db.Column(db.String(50), default="默认")
    createdAt = db.Column(db.DateTime, default=datetime.utcnow)
    updatedAt = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    folderId = db.Column(db.Integer, db.ForeignKey('folder.id'), nullable=True)

class Todo(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    priority = db.Column(db.String(10), default="medium")  # low, medium, high
    completed = db.Column(db.Boolean, default=False)
    type = db.Column(db.String(20), default="todo")  # todo, pomodoro
    createdAt = db.Column(db.DateTime, default=datetime.utcnow)
    updatedAt = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# 项目模型
class Project(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    status = db.Column(db.String(20), default="planning")  # planning/active/completed/onhold
    priority = db.Column(db.String(10), default="medium")  # low/medium/high
    start_date = db.Column(db.Date)
    end_date = db.Column(db.Date)
    progress = db.Column(db.Integer, default=0)  # 0-100
    createdAt = db.Column(db.DateTime, default=datetime.utcnow)
    updatedAt = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# 项目任务模型
class ProjectTask(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    status = db.Column(db.String(20), default="todo")  # todo/inprogress/done
    priority = db.Column(db.String(10), default="medium")
    assignee = db.Column(db.String(100))
    start_date = db.Column(db.Date)
    due_date = db.Column(db.Date)
    projectId = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    createdAt = db.Column(db.DateTime, default=datetime.utcnow)
    updatedAt = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    project = db.relationship('Project', backref=db.backref('tasks', lazy=True, cascade='all, delete-orphan'))

# 项目笔记关联模型
class ProjectNote(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    projectId = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    noteId = db.Column(db.Integer, db.ForeignKey('note.id'), nullable=False)
    createdAt = db.Column(db.DateTime, default=datetime.utcnow)
    
    project = db.relationship('Project', backref=db.backref('project_notes', lazy=True, cascade='all, delete-orphan'))
    note = db.relationship('Note', backref=db.backref('project_links', lazy=True))

@app.route('/')
def index():
    return render_template('index.html')

# API接口
@app.route('/api/folders', methods=['GET'])
def get_folders():
    folders = Folder.query.all()
    return jsonify([{
        'id': folder.id,
        'name': folder.name
    } for folder in folders])

@app.route('/api/notes', methods=['GET'])
def get_notes():
    folder_id = request.args.get('folderId')
    search_query = request.args.get('search')
    
    # 构建基础查询
    query = Note.query
    
    # 如果有文件夹筛选
    if folder_id:
        query = query.filter_by(folderId=folder_id)
    
    # 如果有搜索关键词
    if search_query:
        search_pattern = f'%{search_query}%'
        query = query.filter(
            db.or_(
                Note.title.like(search_pattern),
                Note.content.like(search_pattern),
                Note.tag.like(search_pattern)
            )
        )
    
    notes = query.order_by(Note.updatedAt.desc()).all()
    
    return jsonify([{
        'id': note.id,
        'title': note.title,
        'content': note.content,
        'tag': note.tag,
        'createdAt': note.createdAt.isoformat() if note.createdAt else None,
        'updatedAt': note.updatedAt.isoformat() if note.updatedAt else None,
        'folderId': note.folderId
    } for note in notes])

@app.route('/api/notes', methods=['POST'])
def create_note():
    data = request.json
    note = Note(
        title=data.get('title', ''),
        content=data.get('content', ''),
        tag=data.get('tag', '默认'),
        folderId=data.get('folderId')
    )
    db.session.add(note)
    db.session.commit()
    return jsonify({
        'id': note.id,
        'title': note.title,
        'content': note.content,
        'tag': note.tag,
        'createdAt': note.createdAt.isoformat(),
        'updatedAt': note.updatedAt.isoformat(),
        'folderId': note.folderId
    }), 201

@app.route('/api/notes/<int:note_id>', methods=['PUT'])
def update_note(note_id):
    note = Note.query.get_or_404(note_id)
    data = request.json
    
    note.title = data.get('title', note.title)
    note.content = data.get('content', note.content)
    note.tag = data.get('tag', note.tag)
    note.folderId = data.get('folderId', note.folderId)
    note.updatedAt = datetime.utcnow()
    
    db.session.commit()
    return jsonify({
        'id': note.id,
        'title': note.title,
        'content': note.content,
        'tag': note.tag,
        'updatedAt': note.updatedAt.isoformat(),
        'folderId': note.folderId
    })

@app.route('/api/notes/<int:note_id>', methods=['DELETE'])
def delete_note(note_id):
    note = Note.query.get_or_404(note_id)
    db.session.delete(note)
    db.session.commit()
    return '', 204

# TODO API接口
@app.route('/api/todos', methods=['GET'])
def get_todos():
    todos = Todo.query.order_by(Todo.createdAt.desc()).all()
    return jsonify([{
        'id': todo.id,
        'title': todo.title,
        'description': todo.description,
        'priority': todo.priority,
        'completed': todo.completed,
        'type': todo.type,
        'createdAt': todo.createdAt.isoformat(),
        'updatedAt': todo.updatedAt.isoformat()
    } for todo in todos])

@app.route('/api/todos', methods=['POST'])
def create_todo():
    data = request.get_json()
    todo = Todo(
        title=data.get('title', ''),
        description=data.get('description', ''),
        priority=data.get('priority', 'medium'),
        type=data.get('type', 'todo')
    )
    db.session.add(todo)
    db.session.commit()
    return jsonify({
        'id': todo.id,
        'title': todo.title,
        'description': todo.description,
        'priority': todo.priority,
        'completed': todo.completed,
        'type': todo.type,
        'createdAt': todo.createdAt.isoformat(),
        'updatedAt': todo.updatedAt.isoformat()
    }), 201

@app.route('/api/todos/<int:todo_id>', methods=['PUT'])
def update_todo(todo_id):
    todo = Todo.query.get_or_404(todo_id)
    data = request.get_json()
    
    todo.title = data.get('title', todo.title)
    todo.description = data.get('description', todo.description)
    todo.priority = data.get('priority', todo.priority)
    todo.completed = data.get('completed', todo.completed)
    todo.type = data.get('type', todo.type)
    todo.updatedAt = datetime.utcnow()
    
    db.session.commit()
    return jsonify({
        'id': todo.id,
        'title': todo.title,
        'description': todo.description,
        'priority': todo.priority,
        'completed': todo.completed,
        'type': todo.type,
        'createdAt': todo.createdAt.isoformat(),
        'updatedAt': todo.updatedAt.isoformat()
    })

@app.route('/api/todos/<int:todo_id>', methods=['DELETE'])
def delete_todo(todo_id):
    todo = Todo.query.get_or_404(todo_id)
    db.session.delete(todo)
    db.session.commit()
    return '', 204

# 项目管理API接口
@app.route('/api/projects', methods=['GET'])
def get_projects():
    status_filter = request.args.get('status')
    priority_filter = request.args.get('priority')
    
    query = Project.query
    
    if status_filter:
        query = query.filter_by(status=status_filter)
    if priority_filter:
        query = query.filter_by(priority=priority_filter)
    
    projects = query.order_by(Project.updatedAt.desc()).all()
    
    return jsonify([{
        'id': project.id,
        'name': project.name,
        'description': project.description,
        'status': project.status,
        'priority': project.priority,
        'start_date': project.start_date.isoformat() if project.start_date else None,
        'end_date': project.end_date.isoformat() if project.end_date else None,
        'progress': project.progress,
        'createdAt': project.createdAt.isoformat(),
        'updatedAt': project.updatedAt.isoformat(),
        'taskCount': len(project.tasks),
        'completedTasks': len([task for task in project.tasks if task.status == 'done'])
    } for project in projects])

@app.route('/api/projects', methods=['POST'])
def create_project():
    data = request.get_json()
    
    project = Project(
        name=data.get('name', ''),
        description=data.get('description', ''),
        status=data.get('status', 'planning'),
        priority=data.get('priority', 'medium'),
        start_date=datetime.fromisoformat(data['start_date']) if data.get('start_date') else None,
        end_date=datetime.fromisoformat(data['end_date']) if data.get('end_date') else None,
        progress=data.get('progress', 0)
    )
    
    db.session.add(project)
    db.session.commit()
    
    return jsonify({
        'id': project.id,
        'name': project.name,
        'description': project.description,
        'status': project.status,
        'priority': project.priority,
        'start_date': project.start_date.isoformat() if project.start_date else None,
        'end_date': project.end_date.isoformat() if project.end_date else None,
        'progress': project.progress,
        'createdAt': project.createdAt.isoformat(),
        'updatedAt': project.updatedAt.isoformat(),
        'taskCount': 0,
        'completedTasks': 0
    }), 201

@app.route('/api/projects/<int:project_id>', methods=['PUT'])
def update_project(project_id):
    project = Project.query.get_or_404(project_id)
    data = request.get_json()
    
    project.name = data.get('name', project.name)
    project.description = data.get('description', project.description)
    project.status = data.get('status', project.status)
    project.priority = data.get('priority', project.priority)
    project.start_date = datetime.fromisoformat(data['start_date']) if data.get('start_date') else project.start_date
    project.end_date = datetime.fromisoformat(data['end_date']) if data.get('end_date') else project.end_date
    project.progress = data.get('progress', project.progress)
    project.updatedAt = datetime.utcnow()
    
    db.session.commit()
    
    return jsonify({
        'id': project.id,
        'name': project.name,
        'description': project.description,
        'status': project.status,
        'priority': project.priority,
        'start_date': project.start_date.isoformat() if project.start_date else None,
        'end_date': project.end_date.isoformat() if project.end_date else None,
        'progress': project.progress,
        'updatedAt': project.updatedAt.isoformat(),
        'taskCount': len(project.tasks),
        'completedTasks': len([task for task in project.tasks if task.status == 'done'])
    })

@app.route('/api/projects/<int:project_id>', methods=['DELETE'])
def delete_project(project_id):
    project = Project.query.get_or_404(project_id)
    db.session.delete(project)
    db.session.commit()
    return '', 204

# 项目任务管理接口
@app.route('/api/projects/<int:project_id>/tasks', methods=['GET'])
def get_project_tasks(project_id):
    project = Project.query.get_or_404(project_id)
    status_filter = request.args.get('status')
    
    query = ProjectTask.query.filter_by(projectId=project_id)
    
    if status_filter:
        query = query.filter_by(status=status_filter)
    
    tasks = query.order_by(ProjectTask.createdAt.desc()).all()
    
    return jsonify([{
        'id': task.id,
        'title': task.title,
        'description': task.description,
        'status': task.status,
        'priority': task.priority,
        'assignee': task.assignee,
        'start_date': task.start_date.isoformat() if task.start_date else None,
        'due_date': task.due_date.isoformat() if task.due_date else None,
        'projectId': task.projectId,
        'createdAt': task.createdAt.isoformat(),
        'updatedAt': task.updatedAt.isoformat()
    } for task in tasks])

@app.route('/api/projects/<int:project_id>/tasks', methods=['POST'])
def create_project_task(project_id):
    project = Project.query.get_or_404(project_id)
    data = request.get_json()
    
    task = ProjectTask(
        title=data.get('title', ''),
        description=data.get('description', ''),
        status=data.get('status', 'todo'),
        priority=data.get('priority', 'medium'),
        assignee=data.get('assignee'),
        start_date=datetime.fromisoformat(data['start_date']) if data.get('start_date') else None,
        due_date=datetime.fromisoformat(data['due_date']) if data.get('due_date') else None,
        projectId=project_id
    )
    
    db.session.add(task)
    db.session.commit()
    
    # 更新项目进度
    update_project_progress(project_id)
    
    return jsonify({
        'id': task.id,
        'title': task.title,
        'description': task.description,
        'status': task.status,
        'priority': task.priority,
        'assignee': task.assignee,
        'start_date': task.start_date.isoformat() if task.start_date else None,
        'due_date': task.due_date.isoformat() if task.due_date else None,
        'projectId': task.projectId,
        'createdAt': task.createdAt.isoformat(),
        'updatedAt': task.updatedAt.isoformat()
    }), 201

@app.route('/api/project-tasks/<int:task_id>', methods=['PUT'])
def update_project_task(task_id):
    task = ProjectTask.query.get_or_404(task_id)
    data = request.get_json()
    
    task.title = data.get('title', task.title)
    task.description = data.get('description', task.description)
    task.status = data.get('status', task.status)
    task.priority = data.get('priority', task.priority)
    task.assignee = data.get('assignee', task.assignee)
    task.start_date = datetime.fromisoformat(data['start_date']) if data.get('start_date') else task.start_date
    task.due_date = datetime.fromisoformat(data['due_date']) if data.get('due_date') else task.due_date
    task.updatedAt = datetime.utcnow()
    
    db.session.commit()
    
    # 更新项目进度
    update_project_progress(task.projectId)
    
    return jsonify({
        'id': task.id,
        'title': task.title,
        'description': task.description,
        'status': task.status,
        'priority': task.priority,
        'assignee': task.assignee,
        'start_date': task.start_date.isoformat() if task.start_date else None,
        'due_date': task.due_date.isoformat() if task.due_date else None,
        'projectId': task.projectId,
        'updatedAt': task.updatedAt.isoformat()
    })

@app.route('/api/project-tasks/<int:task_id>', methods=['DELETE'])
def delete_project_task(task_id):
    task = ProjectTask.query.get_or_404(task_id)
    project_id = task.projectId
    
    db.session.delete(task)
    db.session.commit()
    
    # 更新项目进度
    update_project_progress(project_id)
    
    return '', 204

def update_project_progress(project_id):
    """更新项目进度"""
    project = Project.query.get(project_id)
    if project and project.tasks:
        total_tasks = len(project.tasks)
        completed_tasks = len([task for task in project.tasks if task.status == 'done'])
        project.progress = int((completed_tasks / total_tasks) * 100) if total_tasks > 0 else 0
        db.session.commit()

# 项目笔记关联接口
@app.route('/api/projects/<int:project_id>/notes', methods=['GET'])
def get_project_notes(project_id):
    project = Project.query.get_or_404(project_id)
    project_notes = ProjectNote.query.filter_by(projectId=project_id).all()
    
    note_ids = [pn.noteId for pn in project_notes]
    notes = Note.query.filter(Note.id.in_(note_ids)).order_by(Note.updatedAt.desc()).all()
    
    return jsonify([{
        'id': note.id,
        'title': note.title,
        'content': note.content,
        'tag': note.tag,
        'createdAt': note.createdAt.isoformat() if note.createdAt else None,
        'updatedAt': note.updatedAt.isoformat() if note.updatedAt else None,
        'folderId': note.folderId
    } for note in notes])

@app.route('/api/projects/<int:project_id>/notes', methods=['POST'])
def link_note_to_project(project_id):
    project = Project.query.get_or_404(project_id)
    data = request.get_json()
    note_id = data.get('noteId')
    
    if not note_id:
        return jsonify({'error': 'noteId is required'}), 400
    
    note = Note.query.get_or_404(note_id)
    
    # 检查是否已经关联
    existing_link = ProjectNote.query.filter_by(projectId=project_id, noteId=note_id).first()
    if existing_link:
        return jsonify({'error': 'Note already linked to project'}), 400
    
    project_note = ProjectNote(
        projectId=project_id,
        noteId=note_id
    )
    
    db.session.add(project_note)
    db.session.commit()
    
    return jsonify({
        'id': project_note.id,
        'projectId': project_note.projectId,
        'noteId': project_note.noteId,
        'createdAt': project_note.createdAt.isoformat()
    }), 201

@app.route('/api/projects/<int:project_id>/notes/<int:note_id>', methods=['DELETE'])
def unlink_note_from_project(project_id, note_id):
    project_note = ProjectNote.query.filter_by(projectId=project_id, noteId=note_id).first_or_404()
    
    db.session.delete(project_note)
    db.session.commit()
    
    return '', 204

# 项目统计接口
@app.route('/api/projects/stats', methods=['GET'])
def get_project_stats():
    try:
        total_projects = Project.query.count()
        active_projects = Project.query.filter_by(status='active').count()
        completed_projects = Project.query.filter_by(status='completed').count()
        
        total_tasks = ProjectTask.query.count()
        completed_tasks = ProjectTask.query.filter_by(status='done').count()
        
        # 获取最近更新的项目
        recent_projects = Project.query.order_by(Project.updatedAt.desc()).limit(5).all()
        
        return jsonify({
            'totalProjects': total_projects,
            'activeProjects': active_projects,
            'completedProjects': completed_projects,
            'totalTasks': total_tasks,
            'completedTasks': completed_tasks,
            'recentProjects': [{
                'id': p.id,
                'name': p.name,
                'status': p.status,
                'progress': p.progress,
                'updatedAt': p.updatedAt.isoformat()
            } for p in recent_projects]
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# 获取所有标签
@app.route('/api/tags', methods=['GET'])
def get_tags():
    try:
        # 获取所有不重复的标签
        tags = db.session.query(Note.tag).distinct().filter(Note.tag.isnot(None)).filter(Note.tag != '').all()
        tag_list = [tag[0] for tag in tags if tag[0]]
        # 确保"全部"始终在第一位
        if '全部' not in tag_list:
            tag_list.insert(0, '全部')
        else:
            tag_list.remove('全部')
            tag_list.insert(0, '全部')
        return jsonify(tag_list)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# AI接口
@app.route('/api/ai/generate-title', methods=['POST'])
def generate_title():
    data = request.json
    content = data.get('content', '')
    
    if not content:
        return jsonify({'error': '内容不能为空'}), 400
    
    try:
        api_key = os.getenv('OPENROUTER_API_KEY')
        if not api_key:
            return jsonify({'error': '未配置API密钥'}), 500
        
        response = requests.post(
            'https://openrouter.ai/api/v1/chat/completions',
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json'
            },
            json={
                'model': 'gpt-3.5-turbo',
                'messages': [
                    {
                        'role': 'system',
                        'content': '你是一个专业的标题生成器。请根据提供的文本内容生成一个简洁、有吸引力的标题，不超过20个字。'
                    },
                    {
                        'role': 'user',
                        'content': f'请为这个笔记内容生成一个标题：\n\n{content[:500]}...' if len(content) > 500 else content
                    }
                ],
                'max_tokens': 50
            }
        )
        
        result = response.json()
        title = result['choices'][0]['message']['content'].strip().replace('"', '')
        return jsonify({'title': title})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/ai/polish-content', methods=['POST'])
def polish_content():
    data = request.json
    content = data.get('content', '')
    
    if not content:
        return jsonify({'error': '内容不能为空'}), 400
    
    try:
        api_key = os.getenv('OPENROUTER_API_KEY')
        if not api_key:
            return jsonify({'error': '未配置API密钥'}), 500
        
        response = requests.post(
            'https://openrouter.ai/api/v1/chat/completions',
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json'
            },
            json={
                'model': 'gpt-3.5-turbo',
                'messages': [
                    {
                        'role': 'system',
                        'content': '你是一个专业的文本润色专家。请对提供的文本进行润色，使其更加通顺、专业，保持原意不变。'
                    },
                    {
                        'role': 'user',
                        'content': f'请润色这段文本：\n\n{content}'
                    }
                ],
                'max_tokens': 1000
            }
        )
        
        result = response.json()
        polished = result['choices'][0]['message']['content'].strip()
        return jsonify({'polished': polished})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/ai/generate-tags', methods=['POST'])
def generate_tags():
    data = request.json
    content = data.get('content', '')
    
    if not content:
        return jsonify({'error': '内容不能为空'}), 400
    
    try:
        api_key = os.getenv('OPENROUTER_API_KEY')
        if not api_key:
            return jsonify({'error': '未配置API密钥'}), 500
        
        response = requests.post(
            'https://openrouter.ai/api/v1/chat/completions',
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json'
            },
            json={
                'model': 'gpt-3.5-turbo',
                'messages': [
                    {
                        'role': 'system',
                        'content': '你是一个标签生成专家。请根据提供的文本内容生成3-5个相关的标签，用逗号分隔。标签应该简洁、准确，能够概括文本的主要内容和主题。'
                    },
                    {
                        'role': 'user',
                        'content': f'请为这个笔记内容生成标签：\n\n{content[:500]}...' if len(content) > 500 else content
                    }
                ],
                'max_tokens': 100
            }
        )
        
        result = response.json()
        tags = result['choices'][0]['message']['content'].strip()
        # 确保标签格式正确
        tag_list = [tag.strip() for tag in tags.split(',') if tag.strip()]
        return jsonify({'tags': tag_list})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/config', methods=['GET'])
def get_api_config():
    api_key = os.getenv('OPENROUTER_API_KEY')
    return jsonify({
        'has_api_key': bool(api_key)
    })

@app.route('/api/config/api-key', methods=['POST'])
def set_api_key():
    data = request.json
    api_key = data.get('api_key')
    
    if not api_key:
        return jsonify({'error': 'API密钥不能为空'}), 400
    
    try:
        # 验证API密钥
        test_response = requests.post(
            'https://openrouter.ai/api/v1/chat/completions',
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json'
            },
            json={
                'model': 'gpt-3.5-turbo',
                'messages': [{'role': 'user', 'content': 'test'}],
                'max_tokens': 1
            }
        )
        
        if test_response.status_code == 200:
            # 更新.env文件
            env_path = os.path.join(os.path.dirname(__file__), '.env')
            with open(env_path, 'w') as f:
                f.write(f'OPENROUTER_API_KEY="{api_key}"\n')
            
            # 更新环境变量
            os.environ['OPENROUTER_API_KEY'] = api_key
            
            return jsonify({'message': 'API密钥已更新'})
        else:
            return jsonify({'error': 'API密钥无效'}), 400
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# 创建数据库表
with app.app_context():
    db.create_all()

if __name__ == '__main__':
    app.run(debug=True, port=5004)
// 全局变量
let currentNoteId = null;
let currentFolderId = null;
let saveTimeout = null;
let currentSearchQuery = null;
let currentTagFilter = null;


// 初始化应用
document.addEventListener('DOMContentLoaded', async function() {
    await loadFolders();
    await loadTags();
    await loadNotes();
    setupEventListeners();
    checkAPIConfig();
    initCalendar();
    initTodoCalendar();
    initResizeHandles();
});

// 加载文件夹列表
async function loadFolders() {
    try {
        const response = await fetch('/api/folders');
        const folders = await response.json();
        
        const foldersList = document.getElementById('folders-list');
        foldersList.innerHTML = '';
        
        folders.forEach(folder => {
            const folderDiv = document.createElement('div');
            folderDiv.className = 'folder-item';
            folderDiv.textContent = folder.name;
            folderDiv.dataset.folderId = folder.id;
            folderDiv.addEventListener('click', () => selectFolder(folder.id));
            foldersList.appendChild(folderDiv);
        });
    } catch (error) {
        console.error('加载文件夹失败:', error);
    }
}

// 加载标签列表
async function loadTags() {
    try {
        const response = await fetch('/api/tags');
        const tags = await response.json();
        
        const tagsContainer = document.querySelector('.tags-container');
        tagsContainer.innerHTML = '';
        
        tags.forEach((tag, index) => {
            const tagSpan = document.createElement('span');
            tagSpan.className = 'tag-item';
            if (index === 0) { // 第一个标签（"全部"）默认激活
                tagSpan.classList.add('active');
            }
            tagSpan.textContent = tag;
            tagsContainer.appendChild(tagSpan);
        });
        
        // 重新设置标签点击事件监听器
        setupTagClickListeners();
    } catch (error) {
        console.error('加载标签失败:', error);
    }
}

// 加载笔记列表
async function loadNotes(folderId = null, searchQuery = null, tagFilter = null) {
    try {
        let url = '/api/notes';
        const params = new URLSearchParams();
        
        if (folderId) {
            params.append('folderId', folderId);
        }
        
        if (searchQuery) {
            params.append('search', searchQuery);
        }
        
        if (tagFilter && tagFilter !== '全部') {
            params.append('search', tagFilter);
        }
        
        if (params.toString()) {
            url += '?' + params.toString();
        }
        
        const response = await fetch(url);
        const notes = await response.json();
        
        const foldersList = document.getElementById('folders-list');
        
        // 清除现有笔记
        const existingNotes = foldersList.querySelectorAll('.note-item');
        existingNotes.forEach(note => note.remove());
        
        // 添加笔记到对应文件夹
        notes.forEach(note => {
            const noteDiv = document.createElement('div');
            noteDiv.className = 'note-item';
            noteDiv.dataset.noteId = note.id;
            noteDiv.addEventListener('click', () => selectNote(note.id));
            
            // 创建笔记标题和时间的HTML结构
            const titleDiv = document.createElement('div');
            titleDiv.className = 'note-title';
            
            // 创建标题文本
            const titleText = document.createElement('span');
            titleText.textContent = note.title || '无标题';
            titleDiv.appendChild(titleText);
            
            // 创建标签显示
            if (note.tag && note.tag !== '默认') {
                const tagSpan = document.createElement('span');
                tagSpan.className = 'note-tag-display';
                tagSpan.textContent = note.tag;
                titleDiv.appendChild(tagSpan);
            }
            
            const timeDiv = document.createElement('div');
            timeDiv.className = 'note-time';
            
            // 格式化时间
            const formatTime = (dateString) => {
                if (!dateString) return '';
                const date = new Date(dateString);
                return date.toLocaleString('zh-CN', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            };
            
            const updatedTime = formatTime(note.updatedAt);
            const createdTime = formatTime(note.createdAt);
            
            // 创建时间信息结构
            const timeInfoDiv = document.createElement('div');
            timeInfoDiv.className = 'note-time-info';
            
            if (updatedTime) {
                const updatedDiv = document.createElement('div');
                updatedDiv.className = 'note-updated';
                updatedDiv.textContent = updatedTime;
                timeInfoDiv.appendChild(updatedDiv);
            }
            
            // 组装结构
             noteDiv.appendChild(titleDiv);
             if (updatedTime) {
                 timeInfoDiv.appendChild(timeInfoDiv.querySelector('.note-updated'));
                 noteDiv.appendChild(timeInfoDiv);
             }
            
            // 找到对应的文件夹或添加到主文件夹
            const folderElement = foldersList.querySelector(`[data-folder-id="${note.folderId}"]`);
            if (folderElement) {
                folderElement.appendChild(noteDiv);
            } else {
                foldersList.appendChild(noteDiv);
            }
        });
    } catch (error) {
        console.error('加载笔记失败:', error);
    }
}

// 选择文件夹
function selectFolder(folderId) {
    currentFolderId = folderId;
    currentNoteId = null; // 清空当前笔记ID
    
    // 清除搜索状态
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search-btn');
    searchInput.value = '';
    clearSearchBtn.classList.remove('show');
    currentSearchQuery = null;
    
    // 清空编辑器内容
    document.getElementById('note-title').value = '';
    document.getElementById('note-tag').value = '';
    document.getElementById('note-content').value = '';
    
    // 更新UI
    document.querySelectorAll('.folder-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-folder-id="${folderId}"]`).classList.add('active');
    
    loadNotes(folderId);
}

// 选择笔记
async function selectNote(noteId) {
    try {
        const response = await fetch(`/api/notes?folderId=${currentFolderId || ''}`);
        const notes = await response.json();
        const note = notes.find(n => n.id === noteId);
        
        if (note) {
            currentNoteId = noteId;
            
            // 更新UI
            document.querySelectorAll('.note-item').forEach(item => {
                item.classList.remove('active');
            });
            document.querySelector(`[data-note-id="${noteId}"]`).classList.add('active');
            
            // 填充编辑器
            document.getElementById('note-title').value = note.title || '';
            document.getElementById('note-tag').value = note.tag || '默认';
            document.getElementById('note-content').value = note.content || '';
        }
    } catch (error) {
        console.error('加载笔记内容失败:', error);
    }
}

// 创建新笔记
async function createNewNote() {
    try {
        const response = await fetch('/api/notes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                title: '新笔记',
                content: '',
                tag: '默认',
                folderId: currentFolderId
            })
        });
        
        const newNote = await response.json();
        await loadTags(); // 重新加载标签列表
        await loadNotes(currentFolderId);
        await selectNote(newNote.id);
    } catch (error) {
        console.error('创建笔记失败:', error);
    }
}

// 删除笔记
async function deleteCurrentNote() {
    if (!currentNoteId) return;
    
    if (confirm('确定要删除这个笔记吗？')) {
        try {
            await fetch(`/api/notes/${currentNoteId}`, {
                method: 'DELETE'
            });
            
            currentNoteId = null;
            document.getElementById('note-title').value = '';
            document.getElementById('note-tag').value = '';
            document.getElementById('note-content').value = '';
            await loadNotes(currentFolderId);
        } catch (error) {
            console.error('删除笔记失败:', error);
        }
    }
}

// 保存笔记
async function saveNote() {
    if (!currentNoteId) return;
    
    const title = document.getElementById('note-title').value;
    const tag = document.getElementById('note-tag').value || '默认';
    const content = document.getElementById('note-content').value;
    
    try {
        await fetch(`/api/notes/${currentNoteId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                title: title,
                content: content,
                tag: tag,
                folderId: currentFolderId
            })
        });
        
        // 更新保存状态
        document.getElementById('save-status').textContent = '已保存';
        
        // 重新加载标签列表以显示新标签
        await loadTags();
        
        // 重新加载笔记列表以更新时间信息
        if (currentSearchQuery) {
            await loadNotes(null, currentSearchQuery);
        } else {
            await loadNotes(currentFolderId);
        }
        
        // 重新选中当前笔记以保持选中状态
        const noteItem = document.querySelector(`[data-note-id="${currentNoteId}"]`);
        if (noteItem) {
            noteItem.classList.add('active');
        }
    } catch (error) {
        console.error('保存笔记失败:', error);
        document.getElementById('save-status').textContent = '保存失败';
    }
}

// 自动保存（防抖）
function scheduleAutoSave() {
    if (saveTimeout) {
        clearTimeout(saveTimeout);
    }
    
    document.getElementById('save-status').textContent = '正在保存...';
    
    saveTimeout = setTimeout(() => {
        saveNote();
    }, 2000);
}

// 设置事件监听器
function setupEventListeners() {
    // 原有的事件监听器...
    const titleInput = document.getElementById('note-title');
    const contentTextarea = document.getElementById('note-content');
    const tagInput = document.getElementById('note-tag');
    const newNoteBtn = document.getElementById('new-note-btn');
    const deleteNoteBtn = document.getElementById('delete-note-btn');
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const closeSettingsBtn = document.getElementById('close-settings-btn');
    const generateTitleBtn = document.getElementById('generate-title-btn');
    const polishContentBtn = document.getElementById('polish-content-btn');
    const configApiBtn = document.getElementById('config-api-btn');
    const saveApiBtn = document.getElementById('save-api-btn');
    const cancelApiBtn = document.getElementById('cancel-api-btn');
    
    if (titleInput) titleInput.addEventListener('input', scheduleAutoSave);
    if (contentTextarea) contentTextarea.addEventListener('input', scheduleAutoSave);
    if (tagInput) tagInput.addEventListener('input', scheduleAutoSave);
    if (newNoteBtn) newNoteBtn.addEventListener('click', createNewNote);
    if (deleteNoteBtn) deleteNoteBtn.addEventListener('click', deleteCurrentNote);
    if (searchInput) {
        searchInput.addEventListener('input', handleSearchInput);
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                performSearch();
            }
        });
    }
    if (clearSearchBtn) clearSearchBtn.addEventListener('click', clearSearch);
    if (settingsBtn) settingsBtn.addEventListener('click', toggleSettingsPanel);
    if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', hideSettingsPanel);
    if (generateTitleBtn) generateTitleBtn.addEventListener('click', generateAITitle);
    if (polishContentBtn) polishContentBtn.addEventListener('click', polishContentAI);
    if (configApiBtn) configApiBtn.addEventListener('click', showAPIConfigForm);
    if (saveApiBtn) saveApiBtn.addEventListener('click', saveAPIKey);
    if (cancelApiBtn) cancelApiBtn.addEventListener('click', hideAPIConfigForm);
    
    // 新增的TODO和POMODORO相关事件监听器
    const notebookBtn = document.getElementById('notebook-btn');
    const todoBtn = document.getElementById('todo-btn');
    const pomodoroBtn = document.getElementById('pomodoro-btn');
    const projectBtn = document.getElementById('projectBtn');
    const projectOverviewBtn = document.getElementById('project-overview-btn');
    const newProjectOverviewBtn = document.getElementById('new-project-overview-btn');


    const newTodoBtn = document.getElementById('new-todo-btn');
    const addTaskBtn = document.getElementById('add-task-btn');
    const saveTodoBtn = document.getElementById('save-todo-btn');
    const deleteTodoBtn = document.getElementById('delete-todo-btn');
    const todoTitle = document.getElementById('todo-title');
    const todoDescription = document.getElementById('todo-description');
    const todoPriority = document.getElementById('todo-priority');
    
    if (notebookBtn) notebookBtn.addEventListener('click', switchToNotebook);
    if (todoBtn) todoBtn.addEventListener('click', switchToTodo);
    if (pomodoroBtn) pomodoroBtn.addEventListener('click', switchToPomodoro);
    if (projectBtn) projectBtn.addEventListener('click', switchToProject);
    if (projectOverviewBtn) projectOverviewBtn.addEventListener('click', switchToProjectOverview);
    if (newProjectOverviewBtn) newProjectOverviewBtn.addEventListener('click', createNewProject);
    
    // 返回项目概览按钮
    const backToOverviewBtn = document.getElementById('back-to-overview-btn');
    if (backToOverviewBtn) backToOverviewBtn.addEventListener('click', backToProjectOverview);


    if (newTodoBtn) newTodoBtn.addEventListener('click', createNewTodo);
    // 注意：add-task-btn已经在HTML中通过onclick绑定了createNewTodo()，这里不需要重复绑定
    // 保留原有功能，仅移除可能冲突的JavaScript事件绑定
    if (saveTodoBtn) saveTodoBtn.addEventListener('click', saveTodo);
    if (deleteTodoBtn) deleteTodoBtn.addEventListener('click', deleteCurrentTodo);
    
    // 番茄钟任务输入按钮事件监听器
    const saveTaskBtn = document.getElementById('save-task-btn');
    const cancelTaskBtn = document.getElementById('cancel-task-btn');
    if (saveTaskBtn) saveTaskBtn.addEventListener('click', saveNewTask);
    if (cancelTaskBtn) cancelTaskBtn.addEventListener('click', cancelNewTask);
    
    // 番茄钟按钮事件监听器（关联到当前选中的任务）
    const pomodoroStartBtn = document.getElementById('pomodoro-start');
    const pomodoroPauseBtn = document.getElementById('pomodoro-pause');
    const pomodoroResetBtn = document.getElementById('pomodoro-reset');
    
    if (pomodoroStartBtn) pomodoroStartBtn.addEventListener('click', () => {
        if (currentPomodoroTaskId) {
            startMainPomodoroTimer(currentPomodoroTaskId);
        } else {
            alert('请先选择一个任务');
        }
    });
    
    if (pomodoroPauseBtn) pomodoroPauseBtn.addEventListener('click', () => {
        if (currentPomodoroTaskId) {
            pauseTaskPomodoroTimer(currentPomodoroTaskId);
            updateMainPomodoroDisplay(currentPomodoroTaskId);
        }
    });
    
    if (pomodoroResetBtn) pomodoroResetBtn.addEventListener('click', () => {
        if (currentPomodoroTaskId) {
            resetTaskPomodoroTimer(currentPomodoroTaskId);
        } else {
            alert('请先选择一个任务');
        }
    });
    if (todoTitle) todoTitle.addEventListener('input', saveTodo);
    if (todoDescription) todoDescription.addEventListener('input', saveTodo);
    if (todoPriority) todoPriority.addEventListener('change', saveTodo);
    
    // 标签点击事件处理
    setupTagClickListeners();
    

}

// 设置标签点击事件监听器
function setupTagClickListeners() {
    const tagItems = document.querySelectorAll('.tag-item');
    tagItems.forEach(tagItem => {
        tagItem.addEventListener('click', function() {
            // 移除所有标签的激活状态
            tagItems.forEach(item => item.classList.remove('active'));
            // 激活当前点击的标签
            this.classList.add('active');
            
            // 获取标签文本
            const tagText = this.textContent;
            currentTagFilter = tagText;
            
            // 根据标签筛选笔记
            if (tagText === '全部') {
                loadNotes(currentFolderId, currentSearchQuery, null);
            } else {
                loadNotes(currentFolderId, currentSearchQuery, tagText);
            }
        });
    });
}

// AI功能实现
async function generateAITitle() {
    const content = document.getElementById('note-content').value;
    if (!content) {
        alert('请先输入笔记内容');
        return;
    }

    const originalTitle = document.getElementById('note-title').value || '无标题';

    try {
        const response = await fetch('/api/ai/generate-title', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ content })
        });

        const data = await response.json();
        if (data.title) {
            showTitleComparisonDialog(originalTitle, data.title);
        } else {
            alert('生成标题失败：' + (data.error || '未知错误'));
        }
    } catch (error) {
        alert('AI服务连接失败：' + error.message);
    }
}

// 显示标题对比选择对话框
function showTitleComparisonDialog(originalTitle, aiTitle) {
    // 创建对话框元素
    const overlay = document.createElement('div');
    overlay.id = 'title-comparison-overlay';
    overlay.className = 'dialog-overlay';
    
    const dialogContent = document.createElement('div');
    dialogContent.className = 'dialog-content';
    
    dialogContent.innerHTML = `
        <h3>选择标题</h3>
        <div class="title-comparison">
            <div class="title-option">
                <h4>原标题</h4>
                <div class="title-preview original-title">${escapeHtml(originalTitle)}</div>
                <button class="btn primary" data-title="original">使用原标题</button>
            </div>
            <div class="title-option">
                <h4>AI生成标题</h4>
                <div class="title-preview ai-title">${escapeHtml(aiTitle)}</div>
                <button class="btn primary" data-title="ai">使用AI标题</button>
            </div>
        </div>
        <div class="dialog-actions">
            <button class="btn" id="cancel-title-dialog">取消</button>
        </div>
    `;
    
    overlay.appendChild(dialogContent);
    document.body.appendChild(overlay);
    
    // 添加事件监听器
    const originalBtn = dialogContent.querySelector('[data-title="original"]');
    const aiBtn = dialogContent.querySelector('[data-title="ai"]');
    const cancelBtn = dialogContent.querySelector('#cancel-title-dialog');
    
    originalBtn.addEventListener('click', () => selectTitle(originalTitle));
    aiBtn.addEventListener('click', () => selectTitle(aiTitle));
    cancelBtn.addEventListener('click', closeTitleDialog);
    
    // 点击遮罩层关闭对话框
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeTitleDialog();
        }
     });
}

// 初始化TODO界面拖拽分隔条
function initTodoResizeHandles() {
    const leftHandle = document.getElementById('todo-left-resize-handle');
    const rightHandle = document.getElementById('todo-right-resize-handle');
    const todoSidebar = document.querySelector('.todo-sidebar');
    const todoMain = document.querySelector('.todo-main');
    const todoCalendarPanel = document.querySelector('.todo-calendar-panel');
    
    if (!leftHandle || !rightHandle || !todoSidebar || !todoMain || !todoCalendarPanel) {
        return;
    }
    
    let isResizing = false;
    let currentHandle = null;
    let startX = 0;
    let startWidth = 0;
    
    // 左侧分隔条拖拽
    leftHandle.addEventListener('mousedown', (e) => {
        isResizing = true;
        currentHandle = 'left';
        startX = e.clientX;
        startWidth = todoSidebar.offsetWidth;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
    });
    
    // 右侧分隔条拖拽
    rightHandle.addEventListener('mousedown', (e) => {
        isResizing = true;
        currentHandle = 'right';
        startX = e.clientX;
        startWidth = todoCalendarPanel.offsetWidth;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
    });
    
    // 鼠标移动事件
    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        
        const deltaX = e.clientX - startX;
        
        if (currentHandle === 'left') {
            const newWidth = startWidth + deltaX;
            const minWidth = parseInt(getComputedStyle(todoSidebar).minWidth) || 200;
            const maxWidth = parseInt(getComputedStyle(todoSidebar).maxWidth) || 450;
            
            if (newWidth >= minWidth && newWidth <= maxWidth) {
                todoSidebar.style.width = newWidth + 'px';
            }
        } else if (currentHandle === 'right') {
            const newWidth = startWidth - deltaX;
            const minWidth = parseInt(getComputedStyle(todoCalendarPanel).minWidth) || 200;
            const maxWidth = parseInt(getComputedStyle(todoCalendarPanel).maxWidth) || 400;
            
            if (newWidth >= minWidth && newWidth <= maxWidth) {
                todoCalendarPanel.style.width = newWidth + 'px';
            }
        }
    });
    
    // 鼠标释放事件
    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            currentHandle = null;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    });
}

// 显示项目详情页面


// 显示通知
function showNotification(message, type = 'info') {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // 添加样式
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 1000;
        opacity: 0;
        transform: translateX(100%);
        transition: all 0.3s ease;
    `;
    
    // 根据类型设置背景色
    if (type === 'success') {
        notification.style.backgroundColor = '#34c759';
    } else if (type === 'error') {
        notification.style.backgroundColor = '#ff3b30';
    } else {
        notification.style.backgroundColor = '#007aff';
    }
    
    // 添加到页面
    document.body.appendChild(notification);
    
    // 显示动画
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // 自动隐藏
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// HTML转义函数
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 选择标题
function selectTitle(selectedTitle) {
    document.getElementById('note-title').value = selectedTitle;
    scheduleAutoSave(); // 触发自动保存
    closeTitleDialog();
    showAISuggestion('已选择标题：' + selectedTitle);
}

// 关闭标题对话框
function closeTitleDialog() {
    const overlay = document.getElementById('title-comparison-overlay');
    if (overlay) {
        overlay.remove();
    }
}

async function polishContentAI() {
    const content = document.getElementById('note-content').value;
    if (!content) {
        alert('请先输入笔记内容');
        return;
    }

    try {
        const response = await fetch('/api/ai/polish-content', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ content })
        });

        const data = await response.json();
        if (data.polished) {
            showContentComparisonDialog(content, data.polished);
        } else {
            alert('润色内容失败：' + (data.error || '未知错误'));
        }
    } catch (error) {
        alert('AI服务连接失败：' + error.message);
    }
}

// 显示内容对比选择对话框
function showContentComparisonDialog(originalContent, polishedContent) {
    // 创建对话框元素
    const overlay = document.createElement('div');
    overlay.id = 'content-comparison-overlay';
    overlay.className = 'dialog-overlay';
    
    const dialogContent = document.createElement('div');
    dialogContent.className = 'dialog-content content-dialog';
    
    dialogContent.innerHTML = `
        <h3>选择内容</h3>
        <div class="content-comparison">
            <div class="content-option">
                <h4>原内容</h4>
                <div class="content-preview original-content">${escapeHtml(originalContent)}</div>
                <button class="btn primary" data-content="original">使用原内容</button>
            </div>
            <div class="content-option">
                <h4>AI润色内容</h4>
                <div class="content-preview polished-content">${escapeHtml(polishedContent)}</div>
                <button class="btn primary" data-content="polished">使用润色内容</button>
            </div>
        </div>
        <div class="dialog-actions">
            <button class="btn" id="cancel-content-dialog">取消</button>
        </div>
    `;
    
    overlay.appendChild(dialogContent);
    document.body.appendChild(overlay);
    
    // 添加事件监听器
    const originalBtn = dialogContent.querySelector('[data-content="original"]');
    const polishedBtn = dialogContent.querySelector('[data-content="polished"]');
    const cancelBtn = dialogContent.querySelector('#cancel-content-dialog');
    
    originalBtn.addEventListener('click', () => {
        selectContent('original', originalContent, polishedContent);
    });
    
    polishedBtn.addEventListener('click', () => {
        selectContent('polished', originalContent, polishedContent);
    });
    
    cancelBtn.addEventListener('click', closeContentDialog);
    
    // 点击遮罩层关闭对话框
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeContentDialog();
        }
    });
}

// 选择内容
function selectContent(selectedType, originalContent, polishedContent) {
    if (selectedType === 'polished') {
        document.getElementById('note-content').value = polishedContent;
        scheduleAutoSave(); // 触发自动保存
        showAISuggestion('内容已润色完成');
    }
    // 如果选择原内容，不做任何操作
    closeContentDialog();
}

// 关闭内容对话框
function closeContentDialog() {
    const overlay = document.getElementById('content-comparison-overlay');
    if (overlay) {
        overlay.remove();
    }
}

async function generateAITags() {
    const content = document.getElementById('note-content').value;
    if (!content) {
        alert('请先输入笔记内容');
        return;
    }

    try {
        const response = await fetch('/api/ai/generate-tags', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ content })
        });

        const data = await response.json();
        if (data.tags && data.tags.length > 0) {
            showAISuggestion('生成的标签：' + data.tags.join(', '));
        } else {
            alert('生成标签失败：' + (data.error || '未知错误'));
        }
    } catch (error) {
        alert('AI服务连接失败：' + error.message);
    }
}

function showAISuggestion(text) {
    const suggestionsDiv = document.getElementById('ai-suggestions');
    suggestionsDiv.innerHTML = text;
    suggestionsDiv.style.display = 'block';
}

// API配置相关函数
async function checkAPIConfig() {
    try {
        const response = await fetch('/api/config');
        const data = await response.json();
        
        const apiStatusText = document.getElementById('api-status-text');
        const configBtn = document.getElementById('config-api-btn');
        const aiFeatures = document.getElementById('ai-features');
        
        if (data.has_api_key) {
            apiStatusText.textContent = '✅ API密钥已配置';
            configBtn.style.display = 'inline-block';
            configBtn.textContent = '修改API';
            aiFeatures.style.display = 'block';
        } else {
            apiStatusText.textContent = '❌ 未配置API密钥，AI功能不可用';
            configBtn.style.display = 'inline-block';
            configBtn.textContent = '配置API';
            aiFeatures.style.display = 'none';
        }
    } catch (error) {
        console.error('检查API配置失败:', error);
        document.getElementById('api-status-text').textContent = '⚠️ 检查配置时出错';
    }
}
    
    // API密钥配置相关函数
    function showAPIConfigForm() {
        document.getElementById('api-form').style.display = 'block';
        document.getElementById('config-api-btn').style.display = 'none';
    }

    function hideAPIConfigForm() {
        document.getElementById('api-form').style.display = 'none';
        document.getElementById('config-api-btn').style.display = 'inline-block';
        document.getElementById('api-key-input').value = '';
    }

    async function saveAPIKey() {
        const apiKey = document.getElementById('api-key-input').value.trim();
        if (!apiKey) {
            alert('请输入有效的API密钥');
            return;
        }

        document.getElementById('api-loading').style.display = 'block';
        document.getElementById('api-form').style.display = 'none';

        try {
            const response = await fetch('/api/config/api-key', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ api_key: apiKey })
            });

            const data = await response.json();
            
            if (response.ok) {
                alert('API密钥配置成功！AI功能已启用');
                hideAPIConfigForm();
                await checkAPIConfig();
            } else {
                alert('API密钥配置失败：' + (data.error || '未知错误'));
                document.getElementById('api-form').style.display = 'block';
            }
        } catch (error) {
            alert('连接服务器失败：' + error.message);
            document.getElementById('api-form').style.display = 'block';
        } finally {
            document.getElementById('api-loading').style.display = 'none';
        }
    }

function showAPIConfigForm() {
    document.getElementById('api-form').style.display = 'block';
    document.getElementById('config-api-btn').style.display = 'none';
}

function hideAPIConfigForm() {
    document.getElementById('api-form').style.display = 'none';
    document.getElementById('config-api-btn').style.display = 'inline-block';
    document.getElementById('api-key-input').value = '';
}

// 设置面板相关函数
function toggleSettingsPanel() {
    const settingsPanel = document.getElementById('settings-panel');
    if (settingsPanel.style.display === 'none' || !settingsPanel.style.display) {
        settingsPanel.style.display = 'block';
    } else {
        settingsPanel.style.display = 'none';
    }
}

function hideSettingsPanel() {
    document.getElementById('settings-panel').style.display = 'none';
}

async function saveAPIKey() {
    const apiKey = document.getElementById('api-key-input').value.trim();
    if (!apiKey) {
        alert('请输入有效的API密钥');
        return;
    }

    document.getElementById('api-loading').style.display = 'block';
    document.getElementById('api-form').style.display = 'none';

    try {
        const response = await fetch('/api/config/api-key', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ api_key: apiKey })
        });

        const data = await response.json();
        
        if (response.ok) {
            alert('API密钥配置成功！AI功能已启用');
            hideAPIConfigForm();
            await checkAPIConfig();
        } else {
            alert('API密钥配置失败：' + (data.error || '未知错误'));
            document.getElementById('api-form').style.display = 'block';
        }
    } catch (error) {
        alert('连接服务器失败：' + error.message);
        document.getElementById('api-form').style.display = 'block';
    } finally {
        document.getElementById('api-loading').style.display = 'none';
    }
}

// 搜索功能实现
function handleSearchInput() {
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search-btn');
    
    if (searchInput.value.trim()) {
        clearSearchBtn.classList.add('show');
        // 实时搜索（延迟执行）
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            performSearch();
        }, 300);
    } else {
        clearSearchBtn.classList.remove('show');
        clearSearch();
    }
}

async function performSearch() {
    const searchInput = document.getElementById('search-input');
    const searchQuery = searchInput.value.trim();
    
    if (searchQuery) {
        currentSearchQuery = searchQuery;
        // 搜索时清除文件夹选择
        const folderItems = document.querySelectorAll('.folder-item');
        folderItems.forEach(item => item.classList.remove('active'));
        currentFolderId = null;
        
        await loadNotes(null, searchQuery);
    }
}

async function clearSearch() {
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search-btn');
    
    searchInput.value = '';
    clearSearchBtn.classList.remove('show');
    currentSearchQuery = null;
    
    // 重新加载所有笔记
    await loadNotes(currentFolderId);
}

// TODO功能相关变量
let currentTodoId = null;
let todos = [];

// POMODORO功能相关变量（完全独立）
let currentPomodoroTaskId = null;
let pomodoroTasks = [];

// 每个任务的番茄钟状态跟踪
const taskPomodoroTimers = {}; // { taskId: { timeLeft: seconds, isRunning: boolean, isPaused: boolean, sessionCount: number } }
const POMODORO_WORK_TIME = 25 * 60; // 25分钟工作时间
const POMODORO_SHORT_BREAK_TIME = 5 * 60; // 5分钟短休息
const POMODORO_LONG_BREAK_TIME = 15 * 60; // 15分钟长休息

// 获取任务类型（直接使用后端返回的type字段）
function getTaskType(task) {
    return task.type || 'todo';
}

// 界面切换功能
function switchToNotebook() {
    // 隐藏所有界面
    document.getElementById('todo-view').style.display = 'none';
    document.getElementById('pomodoro-view').style.display = 'none';
    document.getElementById('project-view').style.display = 'none';
    document.getElementById('project-overview-view').style.display = 'none';
    document.getElementById('notebook-view').style.display = 'flex';
    
    document.querySelector('.app-container').classList.remove('todo-mode');
    document.querySelector('.app-container').classList.remove('pomodoro-mode');
    document.querySelector('.app-container').classList.remove('project-mode');
    document.querySelector('.app-container').classList.remove('project-overview-mode');
    
    // 更新导航按钮状态
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('notebook-btn').classList.add('active');
    
    // 不重新加载数据，保持当前状态
    // 如果没有选中的笔记但有笔记列表，选中第一个笔记
    if (!currentNoteId) {
        const firstNote = document.querySelector('.note-item');
        if (firstNote) {
            const noteId = firstNote.dataset.noteId;
            if (noteId) {
                selectNote(parseInt(noteId));
            }
        }
    }
}

function switchToTodo() {
    // 隐藏所有界面
    document.getElementById('notebook-view').style.display = 'none';
    document.getElementById('pomodoro-view').style.display = 'none';
    document.getElementById('project-view').style.display = 'none';
    document.getElementById('project-overview-view').style.display = 'none';
    document.getElementById('todo-view').style.display = 'block';
    
    document.querySelector('.app-container').classList.remove('pomodoro-mode');
    document.querySelector('.app-container').classList.remove('project-mode');
    document.querySelector('.app-container').classList.remove('project-overview-mode');
    document.querySelector('.app-container').classList.add('todo-mode');
    document.getElementById('todo-btn').classList.add('active');
    document.getElementById('notebook-btn').classList.remove('active');
    document.getElementById('pomodoro-btn').classList.remove('active');
    document.getElementById('project-overview-btn').classList.remove('active');
    document.getElementById('project-btn').classList.remove('active');
    
    // 只在首次切换或数据为空时加载
    if (todos.length === 0) {
        loadTodos();
    }
    
    // 延迟初始化TODO拖拽功能，确保DOM已切换
    setTimeout(() => {
        initTodoResizeHandles();
    }, 100);
}

function switchToPomodoro() {
    // 隐藏所有界面
    document.getElementById('notebook-view').style.display = 'none';
    document.getElementById('todo-view').style.display = 'none';
    document.getElementById('project-view').style.display = 'none';
    document.getElementById('project-overview-view').style.display = 'none';
    document.getElementById('pomodoro-view').style.display = 'block';
    
    document.querySelector('.app-container').classList.remove('todo-mode');
    document.querySelector('.app-container').classList.remove('project-mode');
    document.querySelector('.app-container').classList.remove('project-overview-mode');
    document.querySelector('.app-container').classList.add('pomodoro-mode');
    document.getElementById('pomodoro-btn').classList.add('active');
    document.getElementById('notebook-btn').classList.remove('active');
    document.getElementById('todo-btn').classList.remove('active');
    document.getElementById('project-overview-btn').classList.remove('active');
    document.getElementById('project-btn').classList.remove('active');
    
    // 只在首次切换或数据为空时加载
    if (pomodoroTasks.length === 0) {
        loadPomodoroTasks();
    }
    
    initPomodoro();
    // 注意：add-task-btn的onclick事件在HTML中已定义，不需要重新绑定
}

// 番茄钟相关变量
let pomodoroTimer = null;
let pomodoroTimeLeft = 25 * 60; // 25分钟
let isPomodoroPaused = false;
let pomodoroSession = 1;
let isBreakTime = false;

// 初始化番茄钟
function initPomodoro() {
    updatePomodoroDisplay();
    updatePomodoroButtons();
}

// 开始番茄钟
function startPomodoro() {
    if (pomodoroTimer) return;
    
    isPomodoroPaused = false;
    pomodoroTimer = setInterval(() => {
        pomodoroTimeLeft--;
        updatePomodoroDisplay();
        
        if (pomodoroTimeLeft <= 0) {
            clearInterval(pomodoroTimer);
            pomodoroTimer = null;
            
            if (isBreakTime) {
                // 休息结束，开始新的工作周期
                isBreakTime = false;
                pomodoroTimeLeft = 25 * 60;
                pomodoroSession++;
                showPomodoroNotification('休息结束！开始新的工作周期');
            } else {
                // 工作周期结束，开始休息
                isBreakTime = true;
                if (pomodoroSession % 4 === 0) {
                    pomodoroTimeLeft = 15 * 60; // 长休息15分钟
                    showPomodoroNotification('完成4个番茄钟！享受15分钟长休息');
                } else {
                    pomodoroTimeLeft = 5 * 60; // 短休息5分钟
                    showPomodoroNotification('番茄钟完成！休息5分钟');
                }
            }
            
            updatePomodoroDisplay();
            updatePomodoroButtons();
        }
    }, 1000);
    
    updatePomodoroButtons();
}

// 暂停番茄钟
function pausePomodoro() {
    if (pomodoroTimer) {
        clearInterval(pomodoroTimer);
        pomodoroTimer = null;
        isPomodoroPaused = true;
        updatePomodoroButtons();
    }
}

// 重置番茄钟
function resetPomodoro() {
    if (pomodoroTimer) {
        clearInterval(pomodoroTimer);
        pomodoroTimer = null;
    }
    
    isPomodoroPaused = false;
    isBreakTime = false;
    pomodoroTimeLeft = 25 * 60;
    updatePomodoroDisplay();
    updatePomodoroButtons();
}

// 更新番茄钟显示
function updatePomodoroDisplay() {
    const minutes = Math.floor(pomodoroTimeLeft / 60);
    const seconds = pomodoroTimeLeft % 60;
    const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    const timerDisplay = document.getElementById('pomodoro-timer');
    const statusDisplay = document.getElementById('pomodoro-status');
    const sessionDisplay = document.getElementById('pomodoro-session');
    
    if (timerDisplay) timerDisplay.textContent = timeString;
    if (statusDisplay) {
        statusDisplay.textContent = isBreakTime ? '休息时间' : '工作时间';
        statusDisplay.className = `pomodoro-status ${isBreakTime ? 'break' : 'work'}`;
    }
    if (sessionDisplay) sessionDisplay.textContent = `第 ${pomodoroSession} 个番茄钟`;
    
    // 更新番茄计时器进度填充
    const progressFill = document.querySelector('.timer-progress-fill');
    if (progressFill) {
        const totalTime = isBreakTime ? (pomodoroSession % 4 === 0 ? 15 * 60 : 5 * 60) : 25 * 60;
        const progress = (totalTime - pomodoroTimeLeft) / totalTime;
        const fillHeight = progress * 160;
        progressFill.setAttribute('height', fillHeight);
        progressFill.setAttribute('y', 230 - fillHeight); // 从底部开始填充
    }
}

// 更新番茄钟按钮状态
function updatePomodoroButtons() {
    const startBtn = document.getElementById('pomodoro-start');
    const pauseBtn = document.getElementById('pomodoro-pause');
    const resetBtn = document.getElementById('pomodoro-reset');
    
    if (startBtn && pauseBtn) {
        if (pomodoroTimer) {
            startBtn.style.display = 'none';
            pauseBtn.style.display = 'inline-block';
            pauseBtn.textContent = '暂停';
        } else if (isPomodoroPaused) {
            startBtn.style.display = 'inline-block';
            pauseBtn.style.display = 'none';
            startBtn.textContent = '继续';
        } else {
            startBtn.style.display = 'inline-block';
            pauseBtn.style.display = 'none';
            startBtn.textContent = '开始';
        }
    }
}

// 显示番茄钟通知
function showPomodoroNotification(message) {
    // 尝试使用浏览器通知
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('番茄钟提醒', {
            body: message,
            icon: '/favicon.ico'
        });
    } else if ('Notification' in window && Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                new Notification('番茄钟提醒', {
                    body: message,
                    icon: '/favicon.ico'
                });
            }
        });
    }
    
    // 同时显示页面内通知
    alert(message);
}

// 加载番茄钟任务列表（独立）
async function loadPomodoroTasks() {
    try {
        const response = await fetch('/api/todos');
        const allTasks = await response.json();
        
        console.log('从API加载的所有任务用于番茄钟:', allTasks);
        
        // 根据任务类型过滤，只保留类型为'pomodoro'的未完成任务
        pomodoroTasks = allTasks.filter(task => getTaskType(task) === 'pomodoro' && !task.completed);
        
        console.log('过滤后的番茄钟任务:', pomodoroTasks);
        renderPomodoroTaskList();
    } catch (error) {
        console.error('加载番茄钟任务失败:', error);
    }
}

// 加载TODO列表
async function loadTodos() {
    try {
        const response = await fetch('/api/todos');
        const allTasks = await response.json();
        
        console.log('从API加载的所有任务用于TODO:', allTasks);
        
        // 根据任务类型过滤
        todos = allTasks.filter(task => getTaskType(task) === 'todo');
        
        console.log('过滤后的TODO任务:', todos);
        renderTodoList();
    } catch (error) {
        console.error('加载TODO失败:', error);
    }
}

// 渲染TODO列表
function renderTodoList() {
    const todoList = document.getElementById('todo-list');
    todoList.innerHTML = '';
    
    // 按完成状态排序：未完成的在前，已完成的在后
    const sortedTodos = [...todos].sort((a, b) => {
        if (a.completed === b.completed) {
            return 0;
        }
        return a.completed ? 1 : -1;
    });
    
    sortedTodos.forEach(todo => {
        const todoDiv = document.createElement('div');
        todoDiv.className = `todo-item ${todo.completed ? 'completed' : ''} ${currentTodoId === todo.id ? 'active' : ''}`;
        todoDiv.dataset.todoId = todo.id;
        todoDiv.draggable = true;
        
        todoDiv.innerHTML = `
            <div class="todo-item-content">
                <div class="todo-item-title">${todo.title || '无标题'}</div>
                <div class="todo-item-meta">
                    <span class="todo-priority ${todo.priority}">${getPriorityText(todo.priority)}</span>
                    <span>${formatDate(todo.updatedAt)}</span>
                </div>
            </div>
            <div class="todo-checkbox ${todo.completed ? 'checked' : ''}" data-todo-id="${todo.id}">
                ${todo.completed ? '✓' : ''}
            </div>
        `;
        
        todoDiv.addEventListener('click', (e) => {
            if (!e.target.classList.contains('todo-checkbox')) {
                selectTodo(todo.id);
            }
        });
        
        // 为复选框添加点击事件
        const checkbox = todoDiv.querySelector('.todo-checkbox');
        checkbox.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleTodoComplete(todo.id);
        });
        
        // 添加拖拽事件监听器
        todoDiv.addEventListener('dragstart', handleDragStart);
        todoDiv.addEventListener('dragover', handleDragOver);
        todoDiv.addEventListener('drop', handleDrop);
        todoDiv.addEventListener('dragend', handleDragEnd);
        
        todoList.appendChild(todoDiv);
    });
}

// 初始化任务的番茄钟状态
function initializeTaskPomodoroTimer(taskId) {
    if (!taskPomodoroTimers[taskId]) {
        taskPomodoroTimers[taskId] = {
            timeLeft: POMODORO_WORK_TIME,
            isRunning: false,
            isPaused: false,
            sessionCount: 0,
            isBreakTime: false
        };
    }
}

// 获取任务的番茄钟状态显示文本（简化版，只显示基本信息）
function getPomodoroTaskStatus(taskId) {
    const timer = taskPomodoroTimers[taskId];
    if (!timer) return '未开始';
    
    if (timer.isRunning) {
        const minutes = Math.floor(timer.timeLeft / 60);
        const seconds = timer.timeLeft % 60;
        const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        if (timer.isBreakTime) {
            return `休息 ${timeStr}`;
        } else {
            return `工作 ${timeStr}`;
        }
    } else if (timer.sessionCount > 0) {
        return `已完成 ${timer.sessionCount} 个`;
    } else {
        return '未开始';
    }
}

// 渲染番茄钟界面的任务列表
function renderPomodoroTaskList() {
    const taskList = document.getElementById('task-list');
    if (!taskList) return; // 如果不在番茄钟界面，直接返回
    
    taskList.innerHTML = '';
    
    // 只显示未完成的番茄钟任务
    const todayTasks = pomodoroTasks.filter(task => !task.completed);
    
    todayTasks.forEach(task => {
        // 初始化任务的番茄钟状态
        initializeTaskPomodoroTimer(task.id);
        
        const taskDiv = document.createElement('div');
        taskDiv.className = `task-item ${currentPomodoroTaskId === task.id ? 'active' : ''}`;
        taskDiv.dataset.taskId = task.id;
        
        const timerStatus = getPomodoroTaskStatus(task.id);
        const timer = taskPomodoroTimers[task.id];
        
        // 添加选中状态
        const isSelected = currentPomodoroTaskId === task.id;
        
        taskDiv.innerHTML = `
            <div class="task-item-content">
                <div class="task-item-title">${task.title || '无标题任务'}</div>
                <div class="task-item-meta">
                    <span class="task-priority ${task.priority}">${getPriorityText(task.priority)}</span>
                </div>
                <div class="task-pomodoro-status ${isSelected ? 'selected' : ''}">
                    <span class="pomodoro-status-text">${timerStatus}</span>
                    ${isSelected ? '<span class="selected-indicator">●</span>' : ''}
                </div>
            </div>
            <div class="task-item-actions">
                <button class="delete-task-btn" data-task-id="${task.id}" title="删除任务">×</button>
            </div>
        `;
        
        taskDiv.addEventListener('click', (e) => {
            if (!e.target.classList.contains('delete-task-btn')) {
                selectPomodoroTask(task.id);
            }
        });
        
        // 为删除按钮添加点击事件
        const deleteBtn = taskDiv.querySelector('.delete-task-btn');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deletePomodoroTask(task.id);
        });
        
        taskList.appendChild(taskDiv);
    });
    
    console.log(`番茄钟任务列表已更新，显示 ${todayTasks.length} 个任务`);
}

// 删除番茄钟界面的任务
async function deletePomodoroTask(taskId) {
    if (confirm('确定要删除这个任务吗？')) {
        try {
            const response = await fetch(`/api/todos/${taskId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                pomodoroTasks = pomodoroTasks.filter(t => t.id !== taskId);
                if (currentPomodoroTaskId === taskId) {
                    currentPomodoroTaskId = null;
                }
                renderPomodoroTaskList();
            }
        } catch (error) {
            console.error('删除番茄钟任务失败:', error);
        }
    }
}

// 显示任务的番茄钟状态（简化版，只更新显示，不控制计时）
function toggleTaskPomodoroTimer(taskId) {
    const timer = taskPomodoroTimers[taskId];
    if (!timer) return;
    
    if (timer.isRunning) {
        // 暂停计时器
        pauseTaskPomodoroTimer(taskId);
    } else {
        // 开始计时器
        startTaskPomodoroTimer(taskId);
    }
}

// 开始任务的番茄钟计时器
function startTaskPomodoroTimer(taskId) {
    const timer = taskPomodoroTimers[taskId];
    if (!timer) return;
    
    timer.isRunning = true;
    timer.isPaused = false;
    
    // 如果计时器已经走完，重置时间
    if (timer.timeLeft <= 0) {
        timer.timeLeft = timer.isBreakTime ? 
            (timer.sessionCount % 4 === 0 ? POMODORO_LONG_BREAK_TIME : POMODORO_SHORT_BREAK_TIME) :
            POMODORO_WORK_TIME;
    }
    
    // 清除现有的主计时器（使用正确的变量名）
    if (window.currentTaskTimer) {
        clearInterval(window.currentTaskTimer);
        window.currentTaskTimer = null;
    }
    
    // 创建新的主计时器
    window.currentTaskTimer = setInterval(() => {
        if (timer.timeLeft > 0) {
            timer.timeLeft--;
            updatePomodoroTaskDisplay(taskId);
            updateMainPomodoroDisplay(taskId);
        } else {
            // 计时结束
            completeTaskPomodoroSession(taskId);
        }
    }, 1000);
    
    updatePomodoroTaskDisplay(taskId);
    console.log(`开始任务 ${taskId} 的番茄钟计时器`);
}

// 暂停任务的番茄钟计时器
function pauseTaskPomodoroTimer(taskId) {
    const timer = taskPomodoroTimers[taskId];
    if (!timer) return;
    
    timer.isRunning = false;
    timer.isPaused = true;
    
    // 清除主计时器（使用正确的变量名）
    if (window.currentTaskTimer) {
        clearInterval(window.currentTaskTimer);
        window.currentTaskTimer = null;
    }
    
    updatePomodoroTaskDisplay(taskId);
    console.log(`暂停任务 ${taskId} 的番茄钟计时器`);
}

// 完成任务的一个番茄钟周期
function completeTaskPomodoroSession(taskId) {
    const timer = taskPomodoroTimers[taskId];
    if (!timer) return;
    
    // 清除主计时器（使用正确的变量名）
    if (window.currentTaskTimer) {
        clearInterval(window.currentTaskTimer);
        window.currentTaskTimer = null;
    }
    
    timer.isRunning = false;
    
    if (timer.isBreakTime) {
        // 休息结束，准备开始工作
        timer.isBreakTime = false;
        timer.timeLeft = POMODORO_WORK_TIME;
        alert('休息结束！准备开始新的工作周期');
    } else {
        // 工作结束，开始休息
        timer.sessionCount++;
        timer.isBreakTime = true;
        
        if (timer.sessionCount % 4 === 0) {
            // 每4个番茄钟后长休息
            timer.timeLeft = POMODORO_LONG_BREAK_TIME;
            alert('恭喜完成4个番茄钟！享受15分钟长休息');
        } else {
            // 短休息
            timer.timeLeft = POMODORO_SHORT_BREAK_TIME;
            alert('番茄钟完成！休息5分钟');
        }
    }
    
    updatePomodoroTaskDisplay(taskId);
    renderPomodoroTaskList(); // 重新渲染以更新状态显示
}

// 更新任务的番茄钟显示
function updatePomodoroTaskDisplay(taskId) {
    const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
    if (!taskElement) return;
    
    const statusElement = taskElement.querySelector('.pomodoro-status-text');
    const controlBtn = taskElement.querySelector('.pomodoro-control-btn');
    const timer = taskPomodoroTimers[taskId];
    
    if (statusElement && timer) {
        statusElement.textContent = getPomodoroTaskStatus(taskId);
    }
    
    if (controlBtn && timer) {
        controlBtn.textContent = timer.isRunning ? '⏸' : '▶';
        controlBtn.title = timer.isRunning ? '暂停' : '开始';
    }
}

// 切换到指定任务的番茄钟状态
function switchToTaskPomodoro(taskId) {
    // 停止当前运行的计时器
    if (window.currentTaskTimer) {
        clearInterval(window.currentTaskTimer);
        window.currentTaskTimer = null;
    }
    
    // 确保任务有计时器状态
    initializeTaskPomodoroTimer(taskId);
    
    const timer = taskPomodoroTimers[taskId];
    if (!timer) return;
    
    // 更新主番茄钟显示
    updateMainPomodoroDisplay(taskId);
    
    // 如果计时器正在运行，继续计时
    if (timer.isRunning) {
        startMainPomodoroTimer(taskId);
    }
    
    console.log(`切换到任务 ${taskId} 的番茄钟状态`);
}

// 更新主番茄钟显示
function updateMainPomodoroDisplay(taskId) {
    const timer = taskPomodoroTimers[taskId];
    if (!timer) return;
    
    // 更新主计时器显示
    const minutes = Math.floor(timer.timeLeft / 60);
    const seconds = timer.timeLeft % 60;
    const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    document.getElementById('pomodoro-timer').textContent = timeStr;
    
    // 更新状态标签
    const statusElement = document.getElementById('pomodoro-status');
    if (statusElement) {
        statusElement.textContent = timer.isBreakTime ? '休息时间' : '工作时间';
        statusElement.className = `pomodoro-status ${timer.isBreakTime ? 'break' : 'work'}`;
    }
    
    // 更新会话信息
    const sessionElement = document.getElementById('pomodoro-session');
    if (sessionElement) {
        sessionElement.textContent = `第 ${timer.sessionCount + 1} 个番茄钟`;
    }
    
    // 更新按钮状态
    updateMainPomodoroButtons(timer.isRunning);
    
    // 更新进度条
    updateMainPomodoroProgress(timer);
}

// 更新主番茄钟按钮状态
function updateMainPomodoroButtons(isRunning) {
    const startBtn = document.getElementById('pomodoro-start');
    const pauseBtn = document.getElementById('pomodoro-pause');
    
    if (startBtn && pauseBtn) {
        if (isRunning) {
            startBtn.style.display = 'none';
            pauseBtn.style.display = 'inline-block';
        } else {
            startBtn.style.display = 'inline-block';
            pauseBtn.style.display = 'none';
        }
    }
}

// 更新主番茄钟进度
function updateMainPomodoroProgress(timer) {
    const totalTime = timer.isBreakTime ? 
        (timer.sessionCount % 4 === 0 ? POMODORO_LONG_BREAK_TIME : POMODORO_SHORT_BREAK_TIME) :
        POMODORO_WORK_TIME;
    
    const progress = (totalTime - timer.timeLeft) / totalTime;
    const progressFill = document.querySelector('.timer-progress-fill');
    if (progressFill) {
        const height = progress * 160; // 160是进度条最大高度
        progressFill.setAttribute('height', height);
        progressFill.setAttribute('y', 230 - height);
    }
}

// 开始主番茄钟计时器（关联到当前任务）
function startMainPomodoroTimer(taskId) {
    const timer = taskPomodoroTimers[taskId];
    if (!timer) return;
    
    timer.isRunning = true;
    timer.isPaused = false;
    
    // 清除现有的计时器
    if (window.currentTaskTimer) {
        clearInterval(window.currentTaskTimer);
    }
    
    // 创建新的计时器
    window.currentTaskTimer = setInterval(() => {
        if (timer.timeLeft > 0) {
            timer.timeLeft--;
            updateMainPomodoroDisplay(taskId);
            
            // 同时更新左侧任务列表的显示
            updatePomodoroTaskDisplay(taskId);
        } else {
            // 计时结束
            completeMainPomodoroSession(taskId);
        }
    }, 1000);
    
    updateMainPomodoroDisplay(taskId);
    console.log(`开始主番茄钟计时器，关联到任务 ${taskId}`);
}

// 重置任务的番茄钟计时器
function resetTaskPomodoroTimer(taskId) {
    const timer = taskPomodoroTimers[taskId];
    if (!timer) return;
    
    // 清除计时器
    if (window.currentTaskTimer) {
        clearInterval(window.currentTaskTimer);
        window.currentTaskTimer = null;
    }
    
    // 重置计时器状态
    timer.timeLeft = POMODORO_WORK_TIME;
    timer.isRunning = false;
    timer.isPaused = false;
    timer.isBreakTime = false;
    
    updateMainPomodoroDisplay(taskId);
    renderPomodoroTaskList();
    
    alert('番茄钟已重置');
}

// 完成主番茄钟会话
function completeMainPomodoroSession(taskId) {
    const timer = taskPomodoroTimers[taskId];
    if (!timer) return;
    
    // 清除计时器
    if (window.currentTaskTimer) {
        clearInterval(window.currentTaskTimer);
        window.currentTaskTimer = null;
    }
    
    timer.isRunning = false;
    
    if (timer.isBreakTime) {
        // 休息结束，准备开始工作
        timer.isBreakTime = false;
        timer.timeLeft = POMODORO_WORK_TIME;
        alert('休息结束！准备开始新的工作周期');
    } else {
        // 工作结束，开始休息
        timer.sessionCount++;
        timer.isBreakTime = true;
        
        if (timer.sessionCount % 4 === 0) {
            // 每4个番茄钟后长休息
            timer.timeLeft = POMODORO_LONG_BREAK_TIME;
            alert('恭喜完成4个番茄钟！享受15分钟长休息');
        } else {
            // 短休息
            timer.timeLeft = POMODORO_SHORT_BREAK_TIME;
            alert('番茄钟完成！休息5分钟');
        }
    }
    
    updateMainPomodoroDisplay(taskId);
    renderPomodoroTaskList(); // 重新渲染以更新状态显示
}

// 显示任务的番茄钟状态（不开始计时）
function displayTaskPomodoroStatus(taskId) {
    // 确保任务有计时器状态
    initializeTaskPomodoroTimer(taskId);
    
    const timer = taskPomodoroTimers[taskId];
    if (!timer) return;
    
    // 更新主番茄钟显示，但不开始计时
    updateMainPomodoroDisplay(taskId);
    
    console.log(`显示任务 ${taskId} 的番茄钟状态`);
}

// 选择番茄钟任务（仅选择，不开始计时）
function selectPomodoroTask(taskId) {
    currentPomodoroTaskId = taskId;
    const task = pomodoroTasks.find(t => t.id === taskId);
    
    if (task) {
        document.getElementById('todo-title').value = task.title || '';
        document.getElementById('todo-description').value = task.description || '';
        document.getElementById('todo-priority').value = task.priority || 'medium';
        
        // 显示该任务的番茄钟状态，但不开始计时
        displayTaskPomodoroStatus(taskId);
    }
    
    renderPomodoroTaskList();
}

// 获取优先级文本
function getPriorityText(priority) {
    const priorityMap = {
        'high': 'P0',
        'p1': 'P1',
        'medium': 'P2',
        'low': 'P3'
    };
    return priorityMap[priority] || 'P2';
}

// 格式化日期
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
        return '今天';
    } else if (days === 1) {
        return '昨天';
    } else if (days < 7) {
        return `${days}天前`;
    } else {
        return date.toLocaleDateString('zh-CN');
    }
}

// 选择TODO
function selectTodo(todoId) {
    currentTodoId = todoId;
    const todo = todos.find(t => t.id === todoId);
    
    if (todo) {
        document.getElementById('todo-title').value = todo.title || '';
        document.getElementById('todo-description').value = todo.description || '';
        document.getElementById('todo-priority').value = todo.priority || 'medium';
    }
    
    renderTodoList();
}

// 创建新的番茄钟任务（专门用于POMODORO界面）
function createNewPomodoroTask() {
    console.log('createNewPomodoroTask函数被调用 - POMODORO界面');
    
    // 显示任务输入框
    const taskInputContainer = document.getElementById('task-input-container');
    const newTaskInput = document.getElementById('new-task-input');
    
    if (taskInputContainer && newTaskInput) {
        taskInputContainer.style.display = 'block';
        newTaskInput.focus();
        console.log('显示番茄钟任务输入框');
    } else {
        console.log('未找到任务输入框元素');
    }
}

// 创建新TODO
async function createNewTodo() {
    console.log('createNewTodo函数被调用 - TODO界面');
    
    try {
        console.log('发送POST请求到/api/todos');
        const response = await fetch('/api/todos', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: '新任务',
                description: '',
                priority: 'medium',
                type: 'todo'  // 标识为TODO任务
            })
        });
        
        console.log('响应状态:', response.status);
        if (response.ok) {
            const newTodo = await response.json();
            console.log('创建的TODO任务:', newTodo);
            
            // 任务类型已在后端保存，无需额外记录
            
            todos.unshift(newTodo);
            currentTodoId = newTodo.id;
            renderTodoList();
            selectTodo(newTodo.id);
            console.log('TODO任务创建成功');
        } else {
            console.error('服务器响应错误:', response.status, response.statusText);
        }
    } catch (error) {
        console.error('创建TODO失败:', error);
    }
}

// 保存新任务（从番茄钟输入框）
async function saveNewTask() {
    const taskInput = document.getElementById('new-task-input');
    const taskInputContainer = document.getElementById('task-input-container');
    
    if (!taskInput || !taskInput.value.trim()) {
        console.log('任务输入为空');
        return;
    }
    
    try {
        console.log('从番茄钟输入框创建新任务:', taskInput.value);
        const response = await fetch('/api/todos', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: taskInput.value.trim(),
                description: '',
                priority: 'medium',
                type: 'pomodoro'  // 标识为番茄钟任务
            })
        });
        
        if (response.ok) {
            const newTask = await response.json();
            console.log('新任务创建成功:', newTask);
            
            // 清空输入框并隐藏
            taskInput.value = '';
            taskInputContainer.style.display = 'none';
            
            // 添加到番茄钟任务列表并重新渲染
            pomodoroTasks.unshift(newTask);
            console.log('开始重新渲染番茄钟任务列表，当前任务数:', pomodoroTasks.length);
            renderPomodoroTaskList();
            
            console.log('番茄钟任务创建完成');
        } else {
            console.error('创建番茄钟任务失败:', response.status, response.statusText);
        }
    } catch (error) {
        console.error('保存番茄钟新任务失败:', error);
    }
}

// 取消新任务输入
function cancelNewTask() {
    const taskInput = document.getElementById('new-task-input');
    const taskInputContainer = document.getElementById('task-input-container');
    
    if (taskInput && taskInputContainer) {
        taskInput.value = '';
        taskInputContainer.style.display = 'none';
        console.log('取消新任务输入');
    }
}

// 保存TODO
async function saveTodo() {
    if (!currentTodoId) return;
    
    try {
        const title = document.getElementById('todo-title').value;
        const description = document.getElementById('todo-description').value;
        const priority = document.getElementById('todo-priority').value;
        
        // 获取当前任务的type字段
        const currentTodo = todos.find(t => t.id === currentTodoId);
        const taskType = currentTodo ? currentTodo.type : 'todo';
        
        const response = await fetch(`/api/todos/${currentTodoId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title,
                description,
                priority,
                type: taskType
            })
        });
        
        if (response.ok) {
            const updatedTodo = await response.json();
            const index = todos.findIndex(t => t.id === currentTodoId);
            if (index !== -1) {
                todos[index] = updatedTodo;
                renderTodoList();
            }
        }
    } catch (error) {
        console.error('保存TODO失败:', error);
    }
}

// 删除TODO
async function deleteCurrentTodo() {
    if (!currentTodoId) return;
    
    if (confirm('确定要删除这个任务吗？')) {
        try {
            const response = await fetch(`/api/todos/${currentTodoId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                todos = todos.filter(t => t.id !== currentTodoId);
                currentTodoId = null;
                document.getElementById('todo-title').value = '';
                document.getElementById('todo-description').value = '';
                document.getElementById('todo-priority').value = 'medium';
                renderTodoList();
            }
        } catch (error) {
            console.error('删除TODO失败:', error);
        }
    }
}

// 切换TODO完成状态
async function toggleTodoComplete(todoId) {
    const todo = todos.find(t => t.id === todoId);
    if (!todo) return;
    
    try {
        const response = await fetch(`/api/todos/${todoId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ...todo,
                completed: !todo.completed
            })
        });
        
        if (response.ok) {
            const updatedTodo = await response.json();
            const index = todos.findIndex(t => t.id === todoId);
            if (index !== -1) {
                todos[index] = updatedTodo;
                renderTodoList();
            }
        }
    } catch (error) {
        console.error('更新TODO状态失败:', error);
    }
}

// 拖拽相关变量
let draggedElement = null;
let draggedTodoId = null;

// 拖拽开始
function handleDragStart(e) {
    draggedElement = e.target;
    draggedTodoId = e.target.dataset.todoId;
    e.target.style.opacity = '0.5';
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target.outerHTML);
}

// 拖拽经过
function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    
    // 添加视觉指示器
    const targetItem = e.target.closest('.todo-item');
    if (targetItem && targetItem !== draggedElement) {
        // 移除所有现有的拖拽指示器
        document.querySelectorAll('.todo-item').forEach(item => {
            item.classList.remove('drag-over');
        });
        // 添加当前目标的指示器
        targetItem.classList.add('drag-over');
    }
    
    return false;
}

// 拖拽放置
function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    
    if (draggedElement !== e.target) {
        const targetTodoId = e.target.closest('.todo-item').dataset.todoId;
        if (targetTodoId && draggedTodoId !== targetTodoId) {
            reorderTodos(draggedTodoId, targetTodoId);
        }
    }
    
    return false;
}

// 拖拽结束
function handleDragEnd(e) {
    e.target.style.opacity = '';
    draggedElement = null;
    draggedTodoId = null;
    
    // 清除所有拖拽指示器
    document.querySelectorAll('.todo-item').forEach(item => {
        item.classList.remove('drag-over');
    });
}

// 重新排序TODO
function reorderTodos(draggedId, targetId) {
    const draggedIndex = todos.findIndex(t => t.id.toString() === draggedId);
    const targetIndex = todos.findIndex(t => t.id.toString() === targetId);
    
    if (draggedIndex !== -1 && targetIndex !== -1) {
        const draggedTodo = todos.splice(draggedIndex, 1)[0];
        todos.splice(targetIndex, 0, draggedTodo);
        renderTodoList();
    }
}

// 日历功能
let currentCalendarDate = new Date();
let selectedDate = null;

function initCalendar() {
    renderCalendar();
    setupCalendarEventListeners();
}

function setupCalendarEventListeners() {
    document.getElementById('prev-month').addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
        renderCalendar();
    });
    
    document.getElementById('next-month').addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
        renderCalendar();
    });
}

function renderCalendar() {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    // 更新月份年份显示
    const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', 
                       '7月', '8月', '9月', '10月', '11月', '12月'];
    document.getElementById('current-month-year').textContent = 
        `${year}年 ${monthNames[month]}`;
    
    // 获取当月第一天和最后一天
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const firstDayWeek = firstDay.getDay(); // 0 = 周日
    const daysInMonth = lastDay.getDate();
    
    // 获取上个月的最后几天
    const prevMonth = new Date(year, month - 1, 0);
    const daysInPrevMonth = prevMonth.getDate();
    
    const calendarDays = document.getElementById('calendar-days');
    calendarDays.innerHTML = '';
    
    // 今天的日期
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
    const todayDate = today.getDate();
    
    // 添加上个月的日期（如果需要）
    for (let i = firstDayWeek - 1; i >= 0; i--) {
        const day = daysInPrevMonth - i;
        const dayElement = createCalendarDay(day, 'other-month');
        calendarDays.appendChild(dayElement);
    }
    
    // 添加当月的日期
    for (let day = 1; day <= daysInMonth; day++) {
        const dayElement = createCalendarDay(day, 'current-month');
        
        // 标记今天
        if (isCurrentMonth && day === todayDate) {
            dayElement.classList.add('today');
        }
        
        // 标记选中的日期
        if (selectedDate && 
            selectedDate.getFullYear() === year && 
            selectedDate.getMonth() === month && 
            selectedDate.getDate() === day) {
            dayElement.classList.add('selected');
        }
        
        calendarDays.appendChild(dayElement);
    }
    
    // 添加下个月的日期（填满6行）
    const totalCells = calendarDays.children.length;
    const remainingCells = 42 - totalCells; // 6行 × 7列 = 42
    for (let day = 1; day <= remainingCells; day++) {
        const dayElement = createCalendarDay(day, 'other-month');
        calendarDays.appendChild(dayElement);
    }
}

function createCalendarDay(day, monthType) {
    const dayElement = document.createElement('div');
    dayElement.className = `calendar-day ${monthType}`;
    dayElement.textContent = day;
    
    if (monthType === 'current-month') {
        dayElement.addEventListener('click', () => {
            // 移除之前选中的日期
            document.querySelectorAll('.calendar-day.selected').forEach(el => {
                el.classList.remove('selected');
            });
            
            // 选中当前日期
            dayElement.classList.add('selected');
            selectedDate = new Date(currentCalendarDate.getFullYear(), 
                                  currentCalendarDate.getMonth(), day);
            
            console.log('选中日期:', selectedDate.toLocaleDateString('zh-CN'));
        });
    }
    
    return dayElement;
}

// TODO日历功能
let todoCurrentCalendarDate = new Date();
let todoSelectedDate = null;

function initTodoCalendar() {
    renderTodoCalendar();
    setupTodoCalendarEventListeners();
}

function setupTodoCalendarEventListeners() {
    document.getElementById('todo-prev-month').addEventListener('click', () => {
        todoCurrentCalendarDate.setMonth(todoCurrentCalendarDate.getMonth() - 1);
        renderTodoCalendar();
    });
    
    document.getElementById('todo-next-month').addEventListener('click', () => {
        todoCurrentCalendarDate.setMonth(todoCurrentCalendarDate.getMonth() + 1);
        renderTodoCalendar();
    });
}

function renderTodoCalendar() {
    const year = todoCurrentCalendarDate.getFullYear();
    const month = todoCurrentCalendarDate.getMonth();
    
    // 更新月份年份显示
    const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', 
                       '7月', '8月', '9月', '10月', '11月', '12月'];
    document.getElementById('todo-current-month-year').textContent = 
        `${year}年 ${monthNames[month]}`;
    
    // 获取当月第一天和最后一天
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const firstDayWeek = firstDay.getDay(); // 0 = 周日
    const daysInMonth = lastDay.getDate();
    
    // 获取上个月的最后几天
    const prevMonth = new Date(year, month - 1, 0);
    const daysInPrevMonth = prevMonth.getDate();
    
    const calendarDays = document.getElementById('todo-calendar-days');
    calendarDays.innerHTML = '';
    
    // 今天的日期
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
    const todayDate = today.getDate();
    
    // 添加上个月的日期（如果需要）
    for (let i = firstDayWeek - 1; i >= 0; i--) {
        const day = daysInPrevMonth - i;
        const dayElement = createTodoCalendarDay(day, 'other-month');
        calendarDays.appendChild(dayElement);
    }
    
    // 添加当月的日期
    for (let day = 1; day <= daysInMonth; day++) {
        const dayElement = createTodoCalendarDay(day, 'current-month');
        
        // 标记今天
        if (isCurrentMonth && day === todayDate) {
            dayElement.classList.add('today');
        }
        
        // 标记选中的日期
        if (todoSelectedDate && 
            todoSelectedDate.getFullYear() === year && 
            todoSelectedDate.getMonth() === month && 
            todoSelectedDate.getDate() === day) {
            dayElement.classList.add('selected');
        }
        
        calendarDays.appendChild(dayElement);
    }
    
    // 添加下个月的日期（填满6行）
    const totalCells = calendarDays.children.length;
    const remainingCells = 42 - totalCells; // 6行 × 7列 = 42
    for (let day = 1; day <= remainingCells; day++) {
        const dayElement = createTodoCalendarDay(day, 'other-month');
        calendarDays.appendChild(dayElement);
    }
}

function createTodoCalendarDay(day, monthType) {
    const dayElement = document.createElement('div');
    dayElement.className = `calendar-day ${monthType}`;
    dayElement.textContent = day;
    
    if (monthType === 'current-month') {
        dayElement.addEventListener('click', () => {
            // 移除之前选中的日期
            document.querySelectorAll('#todo-calendar-days .calendar-day.selected').forEach(el => {
                el.classList.remove('selected');
            });
            
            // 选中当前日期
            dayElement.classList.add('selected');
            todoSelectedDate = new Date(todoCurrentCalendarDate.getFullYear(), 
                                      todoCurrentCalendarDate.getMonth(), day);
            
            console.log('TODO日历选中日期:', todoSelectedDate.toLocaleDateString('zh-CN'));
        });
    }
    
    return dayElement;
}

// 在页面加载时初始化日历
// 移除重复的DOMContentLoaded事件监听器，避免冲突
// initCalendar() 和 initTodoCalendar() 已在主DOMContentLoaded中调用

// ================= 项目管理功能 =================

// 看板相关变量
let currentProject = null;
let kanbanTasks = [];
let draggedTask = null;
let projects = []; // 项目概览数据

// 切换到项目管理视图
function switchToProject() {
    // 隐藏其他界面
    document.getElementById('notebook-view').style.display = 'none';
    document.getElementById('todo-view').style.display = 'none';
    document.getElementById('pomodoro-view').style.display = 'none';
    document.getElementById('project-view').style.display = 'block';
    
    // 清除其他模式
    document.querySelector('.app-container').classList.remove('todo-mode');
    document.querySelector('.app-container').classList.remove('pomodoro-mode');
    document.querySelector('.app-container').classList.add('project-mode');
    
    // 更新导航按钮状态
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('projectBtn').classList.add('active');
    
    // 只在首次切换或数据为空时加载
    if (kanbanTasks.length === 0) {
        loadKanbanTasks();
    }
    
    // 初始化拖拽功能
    initKanbanDragAndDrop();
}

// 切换到项目概览视图
function switchToProjectOverview() {
    // 隐藏其他界面
    document.getElementById('notebook-view').style.display = 'none';
    document.getElementById('todo-view').style.display = 'none';
    document.getElementById('pomodoro-view').style.display = 'none';
    document.getElementById('project-view').style.display = 'none';
    
    // 显示项目概览界面（如果存在）
    const projectOverviewView = document.getElementById('project-overview-view');
    if (projectOverviewView) {
        projectOverviewView.style.display = 'block';
    }
    
    // 清除其他模式
    document.querySelector('.app-container').classList.remove('todo-mode');
    document.querySelector('.app-container').classList.remove('pomodoro-mode');
    document.querySelector('.app-container').classList.remove('project-mode');
    
    // 更新导航按钮状态
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('project-overview-btn').classList.add('active');
    
    // 只在首次切换或数据为空时加载
    if (projects.length === 0) {
        loadProjects();
    }
}

// 加载项目数据
async function loadProjects() {
    try {
        const response = await fetch('/api/projects');
        const projectsData = await response.json();
        
        if (projectsData.error) {
            throw new Error(projectsData.error);
        }
        
        // 存储到全局变量
        projects = projectsData;
        renderProjectGrid(projects);
        
    } catch (error) {
        console.error('加载项目失败:', error);
        showNotification('加载项目失败: ' + error.message, 'error');
    }
}

// 渲染项目网格
function renderProjectGrid(projects) {
    const projectGrid = document.getElementById('project-overview-grid');
    if (!projectGrid) return;
    
    if (!projects || projects.length === 0) {
        projectGrid.innerHTML = '<div class="empty-state">暂无项目，点击上方按钮创建新项目</div>';
        return;
    }
    
    projectGrid.innerHTML = projects.map(project => {
        const statusClass = project.status ? project.status.toLowerCase() : 'active';
        const priorityClass = project.priority ? project.priority.toLowerCase() : 'medium';
        
        return `
            <div class="project-card" data-project-id="${project.id}" onclick="openProjectDetail(${project.id})">
                <div class="project-header">
                    <h3 class="project-title">${escapeHtml(project.name || '未命名项目')}</h3>
                    <div class="project-header-actions">
                        <span class="project-status status-${statusClass}">${project.status || 'Active'}</span>
                        <button class="project-delete-btn" onclick="event.stopPropagation(); deleteProject(${project.id})" title="删除项目">×</button>
                    </div>
                </div>
                <div class="project-meta">
                    <span class="project-priority priority-${priorityClass}">${project.priority || 'Medium'}</span>
                    <span class="project-date">${formatDate(project.created_at)}</span>
                </div>
                <div class="project-description">
                    ${escapeHtml(project.description || '暂无描述')}
                </div>
                <div class="project-stats">
                    <span class="task-count">任务: ${project.task_count || 0}</span>
                    <span class="note-count">笔记: ${project.note_count || 0}</span>
                </div>
            </div>
        `;
    }).join('');
}

// 删除项目
async function deleteProject(projectId) {
    // 创建确认删除对话框
    const dialog = document.createElement('div');
    dialog.className = 'project-delete-dialog';
    dialog.innerHTML = `
        <div class="dialog-overlay" onclick="closeDeleteDialog()">
            <div class="dialog-content" onclick="event.stopPropagation()">
                <h3>确认删除项目</h3>
                <p>确定要删除这个项目吗？此操作不可撤销。</p>
                <div class="dialog-buttons">
                    <button class="btn secondary" onclick="closeDeleteDialog()">取消</button>
                    <button class="btn danger" onclick="confirmDeleteProject(${projectId})">删除</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
}

// 关闭删除确认对话框
function closeDeleteDialog() {
    const dialog = document.querySelector('.project-delete-dialog');
    if (dialog) {
        dialog.remove();
    }
}

// 确认删除项目
async function confirmDeleteProject(projectId) {
    console.log('用户确认删除项目:', projectId);
    closeDeleteDialog();
    
    try {
        const response = await fetch(`/api/projects/${projectId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showNotification('项目删除成功', 'success');
            // 从全局projects数组中移除
            projects = projects.filter(p => p.id !== projectId);
            // 重新渲染项目网格
            renderProjectGrid(projects);
        } else {
            showNotification('删除项目失败', 'error');
        }
    } catch (error) {
        console.error('删除项目时出错:', error);
        showNotification('删除项目时出错', 'error');
    }
}

// 打开项目详情
function openProjectDetail(projectId) {
    // 隐藏项目概览
    document.getElementById('project-overview-view').style.display = 'none';
    // 显示项目详情
    document.getElementById('project-detail-view').style.display = 'block';
    
    // 加载项目详情数据
    loadProjectDetail(projectId);
}

// 加载项目详情
async function loadProjectDetail(projectId) {
    try {
        const response = await fetch(`/api/projects/${projectId}`);
        const project = await response.json();
        
        if (project.error) {
            throw new Error(project.error);
        }
        
        // 填充项目详情表单
        document.getElementById('project-name').value = project.name || '';
        document.getElementById('project-description').value = project.description || '';
        document.getElementById('project-status').value = project.status || 'active';
        document.getElementById('project-priority').value = project.priority || 'medium';
        document.getElementById('project-start-date').value = project.start_date || '';
        document.getElementById('project-end-date').value = project.end_date || '';
        
        // 保存当前项目ID
        currentProject = project;
        
        // 加载项目任务到看板
        loadProjectTasks(projectId);
        
    } catch (error) {
        console.error('加载项目详情失败:', error);
        showNotification('加载项目详情失败: ' + error.message, 'error');
    }
}

// 加载项目任务
async function loadProjectTasks(projectId) {
    try {
        const response = await fetch(`/api/projects/${projectId}/tasks`);
        const tasks = await response.json();
        
        if (tasks.error) {
            throw new Error(tasks.error);
        }
        
        kanbanTasks = tasks;
        renderKanban();
        
    } catch (error) {
        console.error('加载项目任务失败:', error);
        showNotification('加载项目任务失败: ' + error.message, 'error');
    }
}

// 创建新项目
function createNewProject() {
    console.log('createNewProject函数被调用');
    
    // 创建输入对话框
    const dialog = document.createElement('div');
    dialog.className = 'project-input-dialog';
    dialog.innerHTML = `
        <div class="dialog-overlay" onclick="closeProjectDialog()">
            <div class="dialog-content" onclick="event.stopPropagation()">
                <h3>创建新项目</h3>
                <input type="text" id="project-name-input" placeholder="请输入项目名称" maxlength="50">
                <div class="dialog-buttons">
                    <button class="btn secondary" onclick="closeProjectDialog()">取消</button>
                    <button class="btn primary" onclick="confirmCreateProject()">创建</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
    
    // 聚焦到输入框
    setTimeout(() => {
        const input = document.getElementById('project-name-input');
        if (input) {
            input.focus();
            // 支持回车键创建
            input.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    confirmCreateProject();
                }
            });
        }
    }, 100);
}

// 关闭项目创建对话框
function closeProjectDialog() {
    const dialog = document.querySelector('.project-input-dialog');
    if (dialog) {
        dialog.remove();
    }
}

// 确认创建项目
function confirmCreateProject() {
    const input = document.getElementById('project-name-input');
    const projectName = input ? input.value.trim() : '';
    
    if (!projectName) {
        showNotification('请输入项目名称', 'error');
        return;
    }
    
    closeProjectDialog();
    createProject(projectName);
}

// 创建项目API调用
async function createProject(name) {
    try {
        const response = await fetch('/api/projects', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: name })
        });
        
        const result = await response.json();
        
        if (result.error) {
            throw new Error(result.error);
        }
        
        showNotification('项目创建成功!', 'success');
        // 重新加载项目列表
        loadProjects();
        
    } catch (error) {
        console.error('创建项目失败:', error);
        showNotification('创建项目失败: ' + error.message, 'error');
    }
}

// 返回项目概览
function backToProjectOverview() {
    // 隐藏项目详情
    document.getElementById('project-detail-view').style.display = 'none';
    // 显示项目概览
    document.getElementById('project-overview-view').style.display = 'block';
    
    // 重新加载项目列表以获取最新数据
    loadProjects();
}

// 加载看板任务数据
async function loadKanbanTasks() {
    try {
        const response = await fetch('/api/todos');
        const todos = await response.json();
        
        if (todos.error) {
            throw new Error(todos.error);
        }
        
        kanbanTasks = todos;
        renderKanban();
        
    } catch (error) {
        console.error('加载看板任务失败:', error);
        showNotification('加载任务失败: ' + error.message, 'error');
    }
}

// 渲染看板
function renderKanban() {
    const todoColumn = document.getElementById('kanban-todo');
    const inProgressColumn = document.getElementById('kanban-in-progress');
    const doneColumn = document.getElementById('kanban-done');
    
    // 清空现有内容
    todoColumn.innerHTML = '';
    inProgressColumn.innerHTML = '';
    doneColumn.innerHTML = '';
    
    // 按状态分组任务
    const tasksByStatus = {
        'pending': kanbanTasks.filter(task => task.status === 'pending'),
        'in_progress': kanbanTasks.filter(task => task.status === 'in_progress'),
        'completed': kanbanTasks.filter(task => task.status === 'completed')
    };
    
    // 渲染各状态的任务
    tasksByStatus.pending.forEach(task => {
        todoColumn.appendChild(createKanbanTaskCard(task));
    });
    
    tasksByStatus.in_progress.forEach(task => {
        inProgressColumn.appendChild(createKanbanTaskCard(task));
    });
    
    tasksByStatus.completed.forEach(task => {
        doneColumn.appendChild(createKanbanTaskCard(task));
    });
    
    // 更新任务计数
    updateKanbanCounts(tasksByStatus);
}

// 创建看板任务卡片
function createKanbanTaskCard(task) {
    const card = document.createElement('div');
    card.className = 'kanban-task-card';
    card.draggable = true;
    card.dataset.taskId = task.id;
    card.dataset.status = task.status;
    
    // 优先级样式
    const priorityClass = task.priority === 'high' ? 'priority-high' : 
                         task.priority === 'low' ? 'priority-low' : 'priority-medium';
    
    // 截止日期处理
    let dueDateHtml = '';
    if (task.due_date) {
        const dueDate = new Date(task.due_date);
        const today = new Date();
        const isOverdue = dueDate < today && task.status !== 'completed';
        const dueDateClass = isOverdue ? 'overdue' : '';
        
        dueDateHtml = `<div class="task-due-date ${dueDateClass}">
            <i class="fas fa-calendar"></i>
            ${formatDate(task.due_date)}
        </div>`;
    }
    
    card.innerHTML = `
        <div class="task-priority-bar ${priorityClass}"></div>
        <div class="task-header">
            <h4 class="task-title">${escapeHtml(task.title)}</h4>
            <div class="task-actions">
                <button class="task-edit-btn" onclick="editKanbanTask(${task.id})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="task-delete-btn" onclick="deleteKanbanTask(${task.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
        ${task.description ? `<p class="task-description">${escapeHtml(task.description)}</p>` : ''}
        ${dueDateHtml}
        <div class="task-meta">
            <span class="task-priority ${priorityClass}">
                <i class="fas fa-flag"></i>
                ${getPriorityText(task.priority)}
            </span>
            <span class="task-created">
                <i class="fas fa-clock"></i>
                ${formatDate(task.created_at)}
            </span>
        </div>
    `;
    
    // 添加拖拽事件监听器
    card.addEventListener('dragstart', handleKanbanDragStart);
    card.addEventListener('dragend', handleKanbanDragEnd);
    
    return card;
}

// 更新看板任务计数
function updateKanbanCounts(tasksByStatus) {
    document.querySelector('#kanban-todo .column-count').textContent = tasksByStatus.pending.length;
    document.querySelector('#kanban-in-progress .column-count').textContent = tasksByStatus.in_progress.length;
    document.querySelector('#kanban-done .column-count').textContent = tasksByStatus.completed.length;
}

// 初始化看板拖拽功能
function initKanbanDragAndDrop() {
    const columns = document.querySelectorAll('.kanban-column');
    
    columns.forEach(column => {
        column.addEventListener('dragover', handleKanbanDragOver);
        column.addEventListener('drop', handleKanbanDrop);
    });
}

// 处理拖拽开始
function handleKanbanDragStart(e) {
    draggedTask = {
        id: parseInt(e.target.dataset.taskId),
        element: e.target,
        originalStatus: e.target.dataset.status
    };
    
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target.outerHTML);
}

// 处理拖拽结束
function handleKanbanDragEnd(e) {
    e.target.classList.remove('dragging');
    draggedTask = null;
}

// 处理拖拽悬停
function handleKanbanDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    const column = e.currentTarget;
    const afterElement = getDragAfterElement(column, e.clientY);
    const dragging = document.querySelector('.dragging');
    
    if (afterElement == null) {
        column.appendChild(dragging);
    } else {
        column.insertBefore(dragging, afterElement);
    }
}

// 处理拖拽放置
function handleKanbanDrop(e) {
    e.preventDefault();
    
    if (!draggedTask) return;
    
    const column = e.currentTarget;
    const newStatus = column.dataset.status;
    
    // 如果状态发生变化，更新任务状态
    if (draggedTask.originalStatus !== newStatus) {
        updateTaskStatus(draggedTask.id, newStatus);
    }
}

// 获取拖拽后的插入位置
function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.kanban-task-card:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// 更新任务状态
async function updateTaskStatus(taskId, newStatus) {
    try {
        const response = await fetch(`/api/todos/${taskId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: newStatus })
        });
        
        const result = await response.json();
        
        if (result.error) {
            throw new Error(result.error);
        }
        
        // 更新本地数据
        const taskIndex = kanbanTasks.findIndex(task => task.id === taskId);
        if (taskIndex !== -1) {
            kanbanTasks[taskIndex].status = newStatus;
        }
        
        // 重新渲染看板
        renderKanban();
        
        showNotification('任务状态更新成功！', 'success');
        
    } catch (error) {
        console.error('更新任务状态失败:', error);
        showNotification('更新任务状态失败: ' + error.message, 'error');
        
        // 恢复原始状态
        loadKanbanTasks();
    }
}

// 编辑看板任务
function editKanbanTask(taskId) {
    const task = kanbanTasks.find(t => t.id === taskId);
    if (!task) return;
    
    // 切换到待办事项视图并选择该任务
    switchToTodo();
    setTimeout(() => {
        selectTodo(taskId);
    }, 100);
}

// 删除看板任务
async function deleteKanbanTask(taskId) {
    if (!confirm('确定要删除这个任务吗？')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/todos/${taskId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.error) {
            throw new Error(result.error);
        }
        
        // 从本地数据中移除
        kanbanTasks = kanbanTasks.filter(task => task.id !== taskId);
        
        // 重新渲染看板
        renderKanban();
        
        showNotification('任务删除成功！', 'success');
        
    } catch (error) {
        console.error('删除任务失败:', error);
        showNotification('删除任务失败: ' + error.message, 'error');
    }
}

// 创建新的看板任务
function createNewKanbanTask() {
    // 切换到待办事项视图创建新任务
    switchToTodo();
    setTimeout(() => {
        createNewTodo();
    }, 100);
}














// ================= 拖拽分隔条功能 =================

// 初始化拖拽分隔条
function initResizeHandles() {
    const leftHandle = document.getElementById('left-resize-handle');
    const rightHandle = document.getElementById('right-resize-handle');
    const sidebarColumn = document.getElementById('sidebar-column');
    const editorColumn = document.getElementById('editor-column');
    const aiPanelColumn = document.getElementById('ai-panel-column');
    
    if (!leftHandle || !rightHandle || !sidebarColumn || !editorColumn || !aiPanelColumn) {
        return;
    }
    
    let isResizing = false;
    let currentHandle = null;
    let startX = 0;
    let startWidth = 0;
    
    // 左侧分隔条拖拽
    leftHandle.addEventListener('mousedown', (e) => {
        isResizing = true;
        currentHandle = 'left';
        startX = e.clientX;
        startWidth = sidebarColumn.offsetWidth;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
    });
    
    // 右侧分隔条拖拽
    rightHandle.addEventListener('mousedown', (e) => {
        isResizing = true;
        currentHandle = 'right';
        startX = e.clientX;
        startWidth = aiPanelColumn.offsetWidth;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
    });
    
    // 鼠标移动事件
    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        
        const deltaX = e.clientX - startX;
        
        if (currentHandle === 'left') {
            const newWidth = startWidth + deltaX;
            const minWidth = parseInt(getComputedStyle(sidebarColumn).minWidth) || 150;
            const maxWidth = parseInt(getComputedStyle(sidebarColumn).maxWidth) || 400;
            
            if (newWidth >= minWidth && newWidth <= maxWidth) {
                sidebarColumn.style.width = newWidth + 'px';
            }
        } else if (currentHandle === 'right') {
            const newWidth = startWidth - deltaX;
            const minWidth = parseInt(getComputedStyle(aiPanelColumn).minWidth) || 150;
            const maxWidth = parseInt(getComputedStyle(aiPanelColumn).maxWidth) || 350;
            
            if (newWidth >= minWidth && newWidth <= maxWidth) {
                aiPanelColumn.style.width = newWidth + 'px';
            }
        }
    });
    
    // 鼠标释放事件
    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            currentHandle = null;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    });
}
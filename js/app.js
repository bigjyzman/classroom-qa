// ===== 初始化 Firebase =====
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// 使用持久化
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

const ADMIN_EMAIL = 'bnuxiewei@gmail.com';
let isAuthHandling = false; // 防止重复处理认证状态

// ===== 状态管理 =====
const state = {
  user: null,
  isAdmin: false,
  displayName: '',
  questions: [],
  currentQuestionId: null,
  unsubscribe: null,
  filter: 'all', // 'all' | 'mine'
};

// ===== DOM 引用 =====
const $ = id => document.getElementById(id);
const views = {
  login: $('loginView'),
  board: $('boardView'),
};

// ===== 工具函数 =====
function timeAgo(timestamp) {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}天前`;
  return date.toLocaleDateString('zh-CN');
}

function showView(viewName) {
  Object.keys(views).forEach(k => views[k].classList.toggle('active', k === viewName));
}

function showToast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 2500);
}

function closeModal(id) {
  $(id).classList.remove('active');
  document.getElementById(id + 'Overlay').classList.remove('active');
}

function openModal(id) {
  $(id).classList.add('active');
  document.getElementById(id + 'Overlay').classList.add('active');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ===== Auth =====
async function loginAsStudent() {
  const name = $('studentName').value.trim();
  if (!name) { $('loginError').textContent = '请输入你的名字'; $('loginError').style.display = 'block'; return; }
  $('loginError').style.display = 'none';
  $('studentLoginBtn').disabled = true;
  $('studentLoginBtn').textContent = '登录中...';
  isAuthHandling = true;
  try {
    await auth.signInAnonymously();
    state.displayName = name;
    localStorage.setItem('qa_displayName', name);
    await db.collection('users').doc(auth.currentUser.uid).set({
      displayName: name,
      role: 'student',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    await enterBoard();
  } catch (e) {
    $('loginError').textContent = '登录失败：' + e.message;
    $('loginError').style.display = 'block';
  }
  isAuthHandling = false;
  $('studentLoginBtn').disabled = false;
  $('studentLoginBtn').textContent = '进入课堂';
}

async function loginAsAdmin() {
  const email = $('teacherEmail').value.trim();
  const password = $('teacherPassword').value;
  if (!email || !password) { $('loginError').textContent = '请输入邮箱和密码'; $('loginError').style.display = 'block'; return; }
  $('loginError').style.display = 'none';
  $('teacherLoginBtn').disabled = true;
  $('teacherLoginBtn').textContent = '登录中...';
  isAuthHandling = true;
  try {
    await auth.signInWithEmailAndPassword(email, password);
    if (auth.currentUser.email !== ADMIN_EMAIL) {
      await auth.signOut();
      throw new Error('此邮箱不是管理员账号');
    }
    state.displayName = '管理员';
    await enterBoard();
  } catch (e) {
    $('loginError').textContent = '登录失败：' + (e.message || '请检查邮箱和密码');
    $('loginError').style.display = 'block';
  }
  isAuthHandling = false;
  $('teacherLoginBtn').disabled = false;
  $('teacherLoginBtn').textContent = '登录';
}

async function logout() {
  if (state.unsubscribe) state.unsubscribe();
  state.questions = [];
  state.user = null;
  state.isAdmin = false;
  state.displayName = '';
  state.currentQuestionId = null;
  closeModal('askModal');
  closeModal('detailModal');
  closeModal('qrModal');
  await auth.signOut();
  showView('login');
}

async function enterBoard() {
  state.user = auth.currentUser;
  state.isAdmin = state.user.email === ADMIN_EMAIL;
  // displayName was already set by loginAsStudent/loginAsAdmin or restored via onAuthStateChanged
  showView('board');
  renderHeader();
  startListening();
}

// ===== Firestore Listeners =====
function startListening() {
  if (state.unsubscribe) state.unsubscribe();
  let query;
  if (state.isAdmin) {
    query = db.collection('questions');
  } else {
    query = db.collection('questions')
      .where('visibility', '==', 'public');
  }
  state.unsubscribe = query.onSnapshot(snapshot => {
    const allQuestions = [];
    const seen = new Set();
    snapshot.forEach(doc => {
      const data = doc.data();
      data.id = doc.id;
      data._time = data.createdAt;
      allQuestions.push(data);
      seen.add(doc.id);
    });
    // If student, also fetch their own private questions
    if (!state.isAdmin) {
      db.collection('questions')
        .where('authorId', '==', state.user.uid)
        .where('visibility', '==', 'teacher_only')
        .get()
        .then(snap2 => {
          snap2.forEach(doc => {
            if (!seen.has(doc.id)) {
              const data = doc.data();
              data.id = doc.id;
              data._time = data.createdAt;
              allQuestions.push(data);
              seen.add(doc.id);
            }
          });
          allQuestions.sort((a, b) => {
            const ta = a.createdAt ? (a.createdAt.toDate ? a.createdAt.toDate().getTime() : 0) : 0;
            const tb = b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate().getTime() : 0) : 0;
            return tb - ta;
          });
          state.questions = allQuestions;
          renderQuestions();
        });
    } else {
      allQuestions.sort((a, b) => {
        const ta = a.createdAt ? (a.createdAt.toDate ? a.createdAt.toDate().getTime() : 0) : 0;
        const tb = b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate().getTime() : 0) : 0;
        return tb - ta;
      });
      state.questions = allQuestions;
      renderQuestions();
    }
  }, error => {
    console.error('Listener error:', error);
    showToast('加载问题失败，请检查网络');
  });
}

// ===== Render Header =====
function renderHeader() {
  $('headerUserName').textContent = state.displayName;
  $('headerAdminBadge').style.display = state.isAdmin ? 'inline' : 'none';
  $('headerQrBtn').style.display = state.isAdmin ? 'inline-block' : 'none';
}

// ===== Render Questions =====
function renderQuestions() {
  const container = $('questionList');
  let filtered = state.questions;

  // Apply filter
  if (!state.isAdmin && state.filter === 'mine') {
    filtered = filtered.filter(q => q.authorId === state.user.uid);
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">📝</div>
        <h3>还没有问题</h3>
        <p>点击右下角的 + 按钮提出问题</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(q => renderQuestionCard(q)).join('');
  $('questionCount').textContent = `共 ${filtered.length} 个问题`;
}

function renderQuestionCard(q) {
  const isPrivate = q.visibility === 'teacher_only';
  const answerCount = q.answerCount || 0;
  const isOwner = state.user && q.authorId === state.user.uid;
  const latest = q.latestAnswer;

  return `
    <div class="question-card ${isPrivate ? 'teacher-only' : ''}" onclick="openQuestionDetail('${q.id}')">
      <div class="card-header">
        <span class="card-author">${escapeHtml(q.authorName || '匿名')}</span>
        <div class="card-meta">
          <span class="card-time">${timeAgo(q.createdAt)}</span>
          <span class="card-visibility ${isPrivate ? 'private' : 'public'}">
            ${isPrivate ? '仅老师' : '公开'}
          </span>
        </div>
      </div>
      <div class="card-content">${escapeHtml(q.content)}</div>
      ${latest ? `
      <div class="card-latest-answer">
        <span class="latest-answer-author">${escapeHtml(latest.authorName)}</span>
        <span class="latest-answer-content">${escapeHtml(latest.content)}</span>
      </div>` : ''}
      <div class="card-footer">
        <span class="card-stat">💬 ${answerCount} 个回答</span>
        ${isOwner ? `<span class="card-stat" style="color:var(--danger)">点击可删除</span>` : ''}
      </div>
    </div>
  `;
}

// ===== Question CRUD =====
function showAskModal() {
  $('questionContent').value = '';
  document.querySelector('input[name=visibility][value=public]').checked = true;
  $('submitQuestionBtn').disabled = false;
  $('submitQuestionBtn').textContent = '提交问题';
  openModal('askModal');
  setTimeout(() => $('questionContent').focus(), 300);
}

async function submitQuestion() {
  const content = $('questionContent').value.trim();
  if (!content) { showToast('请输入问题内容'); return; }
  const visibility = document.querySelector('input[name=visibility]:checked')?.value || 'public';
  $('submitQuestionBtn').disabled = true;
  $('submitQuestionBtn').textContent = '提交中...';
  try {
    await db.collection('questions').add({
      authorId: state.user.uid,
      authorName: state.displayName,
      content,
      visibility,
      answerCount: 0,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    closeModal('askModal');
    showToast('问题已提交');
  } catch (e) {
    showToast('提交失败：' + e.message);
  }
  $('submitQuestionBtn').disabled = false;
  $('submitQuestionBtn').textContent = '提交问题';
}

async function deleteQuestion(questionId) {
  try {
    // Delete all answers for this question first
    const answersSnap = await db.collection('answers')
      .where('questionId', '==', questionId)
      .get();
    const batch = db.batch();
    answersSnap.forEach(doc => batch.delete(doc.ref));
    batch.delete(db.collection('questions').doc(questionId));
    await batch.commit();
    closeModal('detailModal');
    showToast('问题已删除');
  } catch (e) {
    showToast('删除失败：' + e.message);
  }
}

function confirmDeleteQuestion(questionId) {
  const q = state.questions.find(q => q.id === questionId);
  if (!q) return;
  const canDelete = state.isAdmin || (state.user && q.authorId === state.user.uid);
  if (!canDelete) { showToast('无权删除'); return; }
  const overlay = $('confirmOverlay');
  const box = $('confirmBox');
  $('confirmTitle').textContent = '删除问题';
  $('confirmMessage').textContent = '确定要删除这个问题吗？所有回答也将一并删除。';
  $('confirmDestroyBtn').onclick = async () => {
    overlay.classList.remove('active');
    box.style.display = 'none';
    await deleteQuestion(questionId);
  };
  $('confirmCancelBtn').onclick = () => {
    overlay.classList.remove('active');
    box.style.display = 'none';
  };
  overlay.classList.add('active');
  box.style.display = 'block';
}

// ===== Answer CRUD =====
async function openQuestionDetail(questionId) {
  state.currentQuestionId = questionId;
  const q = state.questions.find(q => q.id === questionId);
  if (!q) return;

  $('detailContent').textContent = q.content;
  $('detailAuthor').textContent = q.authorName || '匿名';
  $('detailTime').textContent = timeAgo(q.createdAt);
  $('detailVisibility').textContent = q.visibility === 'teacher_only' ? '仅老师可见' : '所有人可见';
  $('detailDeleteBtn').style.display = (state.isAdmin || (state.user && q.authorId === state.user.uid)) ? 'inline-block' : 'none';

  // Answer input visibility
  const canAnswer = state.isAdmin || q.visibility === 'public';
  $('detailAnswerArea').style.display = canAnswer ? 'flex' : 'none';
  $('detailAnswerInput').value = '';
  $('detailAnswerInput').placeholder = state.isAdmin ? '输入回答...' : '输入你的回答...';
  $('detailAnswerBtn').disabled = false;

  // Load answers
  $('answersList').innerHTML = '<div class="loading"><div class="spinner"></div>加载回答中...</div>';
  openModal('detailModal');

  try {
    const snap = await db.collection('answers')
      .where('questionId', '==', questionId)
      .get();
    if (snap.empty) {
      $('answersList').innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-secondary);font-size:14px">暂无回答</div>';
      return;
    }
    const answers = [];
    snap.forEach(doc => {
      const a = doc.data();
      a.id = doc.id;
      answers.push(a);
    });
    answers.sort((a, b) => {
      const ta = a.createdAt ? (a.createdAt.toDate ? a.createdAt.toDate().getTime() : 0) : 0;
      const tb = b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate().getTime() : 0) : 0;
      return ta - tb;
    });
    let html = '';
    answers.forEach(a => {
      const isAnswerOwner = state.user && a.authorId === state.user.uid;
      const canDeleteAnswer = isAnswerOwner || state.isAdmin;
      html += `
        <div class="answer-item">
          <div class="answer-header">
            <span class="answer-author">${escapeHtml(a.authorName || '匿名')}</span>
            <div style="display:flex;align-items:center;gap:8px">
              <span class="answer-time">${timeAgo(a.createdAt)}</span>
              ${canDeleteAnswer ? `<span style="color:var(--danger);font-size:12px;cursor:pointer" onclick="deleteAnswer('${a.id}','${questionId}')">删除</span>` : ''}
            </div>
          </div>
          <div class="answer-content">${escapeHtml(a.content)}</div>
        </div>
      `;
    });
    $('answersList').innerHTML = html;
  } catch (e) {
    $('answersList').innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-secondary)">加载回答失败</div>';
  }
}

async function submitAnswer() {
  const content = $('detailAnswerInput').value.trim();
  if (!content) return;
  if (!state.currentQuestionId) return;
  $('detailAnswerBtn').disabled = true;
  try {
    const answerRef = await db.collection('answers').add({
      questionId: state.currentQuestionId,
      authorId: state.user.uid,
      authorName: state.displayName,
      content,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    // Increment answer count and store latest answer preview
    const preview = content.length > 80 ? content.substring(0, 80) + '...' : content;
    await db.collection('questions').doc(state.currentQuestionId).update({
      answerCount: firebase.firestore.FieldValue.increment(1),
      latestAnswer: {
        id: answerRef.id,
        authorName: state.displayName,
        content: preview,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      }
    });
    $('detailAnswerInput').value = '';
    // Reload answers
    openQuestionDetail(state.currentQuestionId);
  } catch (e) {
    console.error('Submit answer error:', e);
    showToast('提交回答失败：' + e.message);
  }
  $('detailAnswerBtn').disabled = false;
}

async function deleteAnswer(answerId, questionId) {
  try {
    await db.collection('answers').doc(answerId).delete();
    await db.collection('questions').doc(questionId).update({
      answerCount: firebase.firestore.FieldValue.increment(-1)
    });
    showToast('回答已删除');
    openQuestionDetail(questionId);
  } catch (e) {
    showToast('删除失败：' + e.message);
  }
}

// ===== QR Code =====
function showQRCode() {
  const url = window.location.href.split('?')[0].split('#')[0];
  $('qrImage').src = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`;
  $('qrUrl').textContent = url;
  openModal('qrModal');
}

// ===== Event Listeners =====
document.addEventListener('DOMContentLoaded', () => {
  // Login tabs
  document.querySelectorAll('.login-tabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.login-tabs button').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.login-form').forEach(f => f.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab + 'Login').classList.add('active');
      $('loginError').style.display = 'none';
    });
  });

  // Enter key for login
  $('studentName').addEventListener('keydown', e => { if (e.key === 'Enter') loginAsStudent(); });
  $('teacherPassword').addEventListener('keydown', e => { if (e.key === 'Enter') loginAsAdmin(); });

  // Enter key for answer
  $('detailAnswerInput').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitAnswer(); } });

  // Filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.filter = btn.dataset.filter;
      renderQuestions();
    });
  });

  // Modal overlay clicks to close
  ['askModal', 'detailModal', 'qrModal'].forEach(id => {
    document.getElementById(id + 'Overlay').addEventListener('click', () => closeModal(id));
  });

  // Confirm overlay click to close
  $('confirmOverlay').addEventListener('click', () => {
    $('confirmOverlay').classList.remove('active');
    $('confirmBox').style.display = 'none';
  });

  // Radio button change label (no-op since each label is static)
  document.querySelectorAll('input[name=visibility]').forEach(rb => {
    rb.addEventListener('change', function() {
      document.querySelectorAll('.visibility-option').forEach(opt => opt.classList.toggle('active', this.checked));
    });
  });

  // Restore student name from localStorage
  const savedName = localStorage.getItem('qa_displayName');
  if (savedName) $('studentName').value = savedName;

  // Check auth state on load
  auth.onAuthStateChanged(async user => {
    if (isAuthHandling) return; // 避免与 loginAsStudent/loginAsAdmin 重复处理
    if (user) {
      // 如果检测到管理员已登录，自动登出，强制走登录页
      if (user.email === ADMIN_EMAIL) {
        await auth.signOut();
        return;
      }
      state.user = user;
      state.isAdmin = false;
      // 优先从 localStorage 读取，否则从 Firestore 恢复
      const savedName = localStorage.getItem('qa_displayName');
      if (savedName) {
        state.displayName = savedName;
      } else {
        try {
          const userDoc = await db.collection('users').doc(user.uid).get();
          if (userDoc.exists) {
            state.displayName = userDoc.data().displayName || '同学';
            localStorage.setItem('qa_displayName', state.displayName);
          } else {
            state.displayName = '同学';
          }
        } catch {
          state.displayName = '同学';
        }
      }
      // Update or create user doc
      try {
        await db.collection('users').doc(user.uid).set({
          displayName: state.displayName,
          role: state.isAdmin ? 'admin' : 'student',
          lastLoginAt: firebase.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      } catch (e) {
        console.warn('Failed to update user doc:', e);
      }
      showView('board');
      renderHeader();
      startListening();
    } else {
      showView('login');
    }
  });
});

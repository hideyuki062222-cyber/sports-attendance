(() => {
  const PENDING_INVITE_KEY = 'pendingGuardianInviteCode';
  const CLAIM_NOTICE_KEY = 'guardianInviteClaimedNotice';
  let pendingClaimInFlight = false;

  const secureInviteCode = (length = 16) => {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let out = '';
    while (out.length < length) {
      const bytes = crypto.getRandomValues(new Uint8Array(Math.max(16, length * 2)));
      for (const b of bytes) {
        if (b >= 252) continue;
        out += chars[b % 36];
        if (out.length === length) break;
      }
    }
    return out;
  };

  try { inviteCode = () => secureInviteCode(16); }
  catch { window.inviteCode = () => secureInviteCode(16); }

  ['password', 'joinPassword', 'newTeamAdminPassword'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.minLength = 10;
    if (el.placeholder) el.placeholder = el.placeholder.replace('6文字以上', '10文字以上');
  });

  const showPendingClaimError = (text) => {
    const targets = ['firstClaimMsg', 'claimMsg', 'msg'];
    const el = targets.map((id) => document.getElementById(id)).find(Boolean);
    if (el) el.textContent = text;
  };

  const completePendingGuardianInvite = async () => {
    if (pendingClaimInFlight) return false;
    const code = (localStorage.getItem(PENDING_INVITE_KEY) || '').trim().toUpperCase();
    if (!code) return false;

    const { data: sessionData } = await sb.auth.getSession();
    if (!sessionData?.session?.user) return false;

    pendingClaimInFlight = true;
    try {
      const { data, error } = await sb.functions.invoke('claim-guardian-invite', { body: { code } });
      if (error || !data?.ok) {
        let text = data?.error || error?.message || '招待コードの連携を完了できませんでした。';
        try {
          if (error?.context) {
            const j = await error.context.json();
            text = j.error || text;
          }
        } catch {}
        showPendingClaimError('メール確認は完了しましたが、招待コードの連携に失敗しました。もう一度招待コードを入力してください。' + (text ? ' ' + text : ''));
        return false;
      }

      localStorage.removeItem(PENDING_INVITE_KEY);
      localStorage.removeItem('signupMode');
      sessionStorage.setItem(CLAIM_NOTICE_KEY, '1');
      location.reload();
      return true;
    } finally {
      pendingClaimInFlight = false;
    }
  };

  if (sessionStorage.getItem(CLAIM_NOTICE_KEY) === '1') {
    sessionStorage.removeItem(CLAIM_NOTICE_KEY);
    setTimeout(() => {
      if (typeof showToast === 'function') showToast('✓ メール確認と選手の連携が完了しました');
    }, 500);
  }

  sb.auth.getSession().then(() => completePendingGuardianInvite()).catch(() => {});
  sb.auth.onAuthStateChange((_event, session) => {
    if (session?.user) setTimeout(() => completePendingGuardianInvite(), 0);
  });

  const signup = document.getElementById('signupCurrent');
  if (signup) signup.onclick = async () => {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    if (!email.includes('@') || password.length < 10) {
      return msg('msg', 'メールアドレスと10文字以上のパスワードを入力してください。');
    }
    const code = prompt('管理者から受け取った招待コードを入力してください');
    if (code === null) return;
    if (!code.trim()) return msg('msg', '招待コードを入力してください。');

    signupMode = 'guardian';
    localStorage.setItem('signupMode', 'guardian');
    msg('msg', '登録しています…');
    const { data, error } = await sb.functions.invoke('register-guardian', {
      body: { email, password, code: code.trim() }
    });
    if (error || data?.error) {
      let text = data?.error || error?.message || '登録できませんでした。';
      try {
        if (error?.context) {
          const j = await error.context.json();
          text = j.error || text;
        }
      } catch {}
      return msg('msg', text);
    }

    if (data?.email_confirmation_required) {
      localStorage.setItem(PENDING_INVITE_KEY, code.trim().toUpperCase());
      msg('msg', data.message || '確認メールを送信しました。メール内のリンクを開いてからログインしてください。');
      return;
    }

    const login = await sb.auth.signInWithPassword({ email, password });
    if (login.error) return msg('msg', '登録できました。ログインしてください。');
    user = login.data.user;
    localStorage.removeItem('signupMode');
    msg('msg', '✓ 登録できました！');
    return enter();
  };

  const teamJoin = document.getElementById('submitTeamJoin');
  if (teamJoin) teamJoin.onclick = async () => {
    const name = document.getElementById('joinPlayerName').value.trim();
    const categorySelect = document.getElementById('joinCategorySelect');
    const categoryName = categorySelect.value === 'その他'
      ? document.getElementById('joinCategoryOther').value.trim()
      : categorySelect.value;
    if (!name) return msg('teamJoinMsg', '選手名を入力してください。');
    if (!categoryName) return msg('teamJoinMsg', '区分・学年を入力してください。');

    const body = {
      action: 'register',
      code: joinCode,
      player_name: name,
      birth_date: document.getElementById('joinBirthDate').value,
      category_name: categoryName,
      email: document.getElementById('joinEmail').value.trim(),
      password: document.getElementById('joinPassword').value
    };
    if (!body.email.includes('@')) return msg('teamJoinMsg', 'メールアドレスを入力してください。');
    if (body.password.length < 10) return msg('teamJoinMsg', 'パスワードは10文字以上にしてください。');

    teamJoin.disabled = true;
    const old = teamJoin.textContent;
    teamJoin.textContent = '送信しています…';
    msg('teamJoinMsg', '');
    const { data, error } = await sb.functions.invoke('team-register', { body });
    teamJoin.disabled = false;
    teamJoin.textContent = old;
    if (error || data?.error) {
      let text = data?.error || error?.message || '登録申請を送信できませんでした。';
      try {
        if (error?.context) {
          const j = await error.context.json();
          text = j.error || text;
        }
      } catch {}
      return msg('teamJoinMsg', text);
    }

    msg('teamJoinMsg', '✅ ' + (data?.message || '登録申請を送信しました。管理者の承認をお待ちください。'));
    teamJoin.disabled = true;
    ['joinPlayerName', 'joinCategorySelect', 'joinCategoryOther', 'joinEmail', 'joinPassword'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.disabled = true;
    });
  };

  const createSystemTeam = document.getElementById('createSystemTeam');
  if (createSystemTeam) createSystemTeam.onclick = async () => {
    const name = document.getElementById('newTeamName').value.trim();
    const sport = document.getElementById('newTeamSport').value;
    const email = document.getElementById('newTeamAdminEmail').value.trim();
    const password = document.getElementById('newTeamAdminPassword').value;
    if (!name) return msg('createSystemTeamMsg', 'チーム名を入力してください。');
    if (!email.includes('@')) return msg('createSystemTeamMsg', '管理者メールアドレスを入力してください。');
    if (password.length < 10) return msg('createSystemTeamMsg', '初期パスワードは10文字以上にしてください。');

    msg('createSystemTeamMsg', '登録しています…');
    const { data, error } = await sb.functions.invoke('system-admin-teams', {
      body: { action: 'create_team', name, sport, email, password }
    });
    if (error || data?.error) {
      let text = data?.error || error?.message || '登録できませんでした。';
      try {
        if (error?.context) {
          const j = await error.context.json();
          text = j.error || text;
        }
      } catch {}
      return msg('createSystemTeamMsg', text);
    }
    msg('createSystemTeamMsg', '✓ チームと管理者を登録しました！');
    document.getElementById('newTeamName').value = '';
    document.getElementById('newTeamAdminEmail').value = '';
    document.getElementById('newTeamAdminPassword').value = '';
    setTimeout(openSystemAdmin, 700);
  };
})();

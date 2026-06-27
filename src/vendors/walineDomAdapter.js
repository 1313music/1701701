export const getWalineHeaderText = (labelText, input) => {
  if (labelText) return labelText;
  const fieldName = (input?.getAttribute('name') || '').toLowerCase();
  if (fieldName.includes('nick')) return '昵称';
  if (fieldName.includes('mail') || fieldName.includes('email')) return '邮箱';
  return '';
};

export const syncWalineHeaderPlaceholders = (root) => {
  if (!root) return;
  const headerItems = root.querySelectorAll('.wl-header-item');
  headerItems.forEach((item) => {
    const label = item.querySelector('label');
    const input = item.querySelector('input');
    if (!input) return;
    const text = getWalineHeaderText(label?.textContent?.trim(), input);
    if (!text) return;
    input.placeholder = text;
    input.setAttribute('aria-label', text);
  });

  const textareas = root.querySelectorAll('textarea');
  textareas.forEach((textarea) => {
    textarea.placeholder = '说点什么吧';
  });
};

export const syncWalineAuthButtons = ({ root, onLogin, onRegister }) => {
  if (!root) return;
  const ownerDocument = root.ownerDocument || document;
  const existingButtons = root.querySelectorAll('.wl-register-btn');
  const footer = root.querySelector('.wl-footer');
  const originalLoginButton = footer?.querySelector('button.wl-btn:not(.primary):not(.wl-login-btn):not(.wl-register-btn)');
  const loginButton = footer?.querySelector('button.wl-login-btn');

  if (!footer || (!loginButton && !originalLoginButton)) {
    existingButtons.forEach((button) => button.remove());
    return;
  }

  let controlledLoginButton = loginButton;

  if (!controlledLoginButton && originalLoginButton) {
    controlledLoginButton = ownerDocument.createElement('button');
    controlledLoginButton.type = 'button';
    controlledLoginButton.className = `${originalLoginButton.className} wl-login-btn`;
    controlledLoginButton.textContent = originalLoginButton.textContent || '登录';
    controlledLoginButton.setAttribute('aria-label', '登录 Waline 账号');
    controlledLoginButton.addEventListener('click', onLogin);
    originalLoginButton.replaceWith(controlledLoginButton);
  }

  if (!controlledLoginButton) {
    existingButtons.forEach((button) => button.remove());
    return;
  }

  const existingNextButton = controlledLoginButton.nextElementSibling;
  if (existingNextButton?.classList.contains('wl-register-btn')) {
    return;
  }

  existingButtons.forEach((button) => button.remove());

  const registerButton = ownerDocument.createElement('button');
  registerButton.type = 'button';
  registerButton.className = 'wl-btn wl-register-btn';
  registerButton.textContent = '注册';
  registerButton.setAttribute('aria-label', '注册 Waline 账号');
  registerButton.addEventListener('click', onRegister);
  controlledLoginButton.insertAdjacentElement('afterend', registerButton);
};

export const syncWalineProfileAction = ({ root, onProfile }) => {
  if (!root) return;

  const profileLinks = root.querySelectorAll('.wl-login-info .wl-login-nick');
  profileLinks.forEach((link) => {
    link.__walineProfileAction = onProfile;
    link.setAttribute('aria-label', '打开 Waline 账号设置');

    if (link.dataset.walineProfileBridge === 'true') return;

    link.dataset.walineProfileBridge = 'true';
    link.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      link.__walineProfileAction?.(event);
    }, true);
  });
};

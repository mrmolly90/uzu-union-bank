/* ==========================================================================
   UZU UNION BANK — Auth Module
   Login/Register with real API calls, multi-step KYC, password strength.
   ========================================================================== */

const AuthModule = (() => {
  let currentStep = 1;

  function init() {
    setupTabs();
    setupLoginForm();
    setupRegisterForm();
    setupPasswordStrength();
    checkUrlHash();
  }

  /* --- Tab Switching --- */
  function setupTabs() {
    const tabs = document.querySelectorAll('.auth-tab');
    const loginPanel = document.getElementById('formLogin');
    const registerPanel = document.getElementById('formRegister');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        tabs.forEach(t => {
          t.classList.remove('bg-uzu-emerald', 'text-uzu-950', 'shadow-lg', 'shadow-uzu-emerald/20');
          t.classList.add('text-gray-400');
        });
        tab.classList.remove('text-gray-400');
        tab.classList.add('bg-uzu-emerald', 'text-uzu-950', 'shadow-lg', 'shadow-uzu-emerald/20');

        if (loginPanel) loginPanel.classList.toggle('hidden', target !== 'login');
        if (registerPanel) registerPanel.classList.toggle('hidden', target !== 'register');
        window.location.hash = target === 'register' ? 'register' : 'login';
      });
    });
  }

  function checkUrlHash() {
    if (window.location.hash === '#register') {
      const registerTab = document.querySelector('.auth-tab[data-tab="register"]');
      if (registerTab) registerTab.click();
    }
  }

  /* --- Login Form --- */
  function setupLoginForm() {
    const form = document.getElementById('loginForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail')?.value.trim();
      const password = document.getElementById('loginPassword')?.value;
      const submitBtn = document.getElementById('loginSubmit');
      const submitText = document.getElementById('loginSubmitText');

      if (!validateLogin(email, password)) return;

      submitBtn.disabled = true;
      submitText.innerHTML = '<span class="spinner"></span> Signing In…';

      try {
        const data = await ApiClient.login(email, password);
        sessionStorage.setItem('uzu_token', data.token);
        sessionStorage.setItem('uzu_user', JSON.stringify(data.user));
        Toast.success(`Welcome back, ${data.user.fullName}! Redirecting…`);
        setTimeout(() => { window.location.href = '/dashboard.html'; }, 1000);
      } catch (err) {
        Toast.error(err.message || 'Login failed.');
        form.classList.add('shake');
        setTimeout(() => form.classList.remove('shake'), 500);
      } finally {
        submitBtn.disabled = false;
        submitText.textContent = 'Sign In';
      }
    });
  }

  function validateLogin(email, password) {
    let valid = true;
    const emailErr = document.getElementById('loginEmailError');
    const passErr = document.getElementById('loginPasswordError');
    const emailInput = document.getElementById('loginEmail');
    const passInput = document.getElementById('loginPassword');

    if (emailErr) emailErr.classList.add('hidden');
    if (passErr) passErr.classList.add('hidden');
    if (emailInput) emailInput.style.borderColor = '';
    if (passInput) passInput.style.borderColor = '';

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      if (emailErr) emailErr.classList.remove('hidden');
      if (emailInput) emailInput.style.borderColor = '#EF4444';
      valid = false;
    }
    if (!password) {
      if (passErr) passErr.classList.remove('hidden');
      if (passInput) passInput.style.borderColor = '#EF4444';
      valid = false;
    }
    return valid;
  }

  /* --- Register Form --- */
  function setupRegisterForm() {
    const form = document.getElementById('registerForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('regEmail')?.value.trim();
      const password = document.getElementById('regPassword')?.value;
      const confirm = document.getElementById('regConfirm')?.value;
      const bankPin = document.getElementById('regBankPin')?.value;
      const confirmBankPin = document.getElementById('regConfirmBankPin')?.value;
      const fullName = document.getElementById('regFullName')?.value.trim();
      const country = document.getElementById('regCountry')?.value;
      const compliance = document.getElementById('regCompliance');
      const submitBtn = document.getElementById('regSubmit');
      const submitText = document.getElementById('regSubmitText');

      if (password !== confirm) { Toast.error('Passwords do not match.'); return; }
      if (password.length < 5) { Toast.error('Password must be at least 5 characters.'); return; }
      if (!/^\d{4}$/.test(bankPin)) { Toast.error('Bank PIN must be exactly 4 digits.'); return; }
      if (bankPin !== confirmBankPin) { Toast.error('Bank PINs do not match.'); return; }
      if (!compliance?.checked) { Toast.error('Please accept the terms.'); return; }

      submitBtn.disabled = true;
      submitText.innerHTML = '<span class="spinner"></span> Creating Account…';

      try {
        const data = await ApiClient.register({ email, password, bankPin, fullName, country });
        sessionStorage.setItem('uzu_token', data.token);
        sessionStorage.setItem('uzu_user', JSON.stringify(data.user));
        Toast.success('Account created successfully!');
        resetRegistration();
        setTimeout(() => {
          const loginTab = document.querySelector('.auth-tab[data-tab="login"]');
          if (loginTab) loginTab.click();
        }, 1500);
      } catch (err) {
        Toast.error(err.message || 'Registration failed.');
      } finally {
        submitBtn.disabled = false;
        submitText.textContent = 'Create Secure Account';
      }
    });
  }

  function resetRegistration() {
    document.getElementById('registerForm')?.reset();
    document.querySelectorAll('.reg-step').forEach(el => el.classList.add('hidden'));
    document.querySelector('.reg-step[data-step="1"]')?.classList.remove('hidden');
    currentStep = 1;
    document.querySelectorAll('.step-indicator__item').forEach(el => {
      el.className = 'step-indicator__item';
      if (parseInt(el.dataset.step) === 1) el.classList.add('step-indicator__item--active');
    });
  }

  /* --- Password Strength --- */
  function setupPasswordStrength() {
    const input = document.getElementById('regPassword');
    const bars = document.getElementById('passwordStrength');
    const text = document.getElementById('passwordStrengthText');
    if (input && bars && text) {
      input.addEventListener('input', () => {
        PasswordUtils.updateStrengthMeter(input.value, bars, text);
      });
    }
  }

  /* --- Step Navigation (exposed globally for onclick) --- */
  window.nextStep = (step) => {
    const currentEl = document.querySelector(`.reg-step[data-step="${currentStep}"]`);
    const inputs = currentEl?.querySelectorAll('input[required], select[required]') || [];
    let valid = true;
    inputs.forEach(inp => {
      if (!inp.value.trim()) { inp.style.borderColor = '#EF4444'; valid = false; }
      else inp.style.borderColor = '';
    });
    if (!valid) { Toast.error('Please fill in all required fields.'); return; }

    document.querySelectorAll('.reg-step').forEach(el => el.classList.add('hidden'));
    document.querySelector(`.reg-step[data-step="${step}"]`)?.classList.remove('hidden');
    document.querySelectorAll('.step-indicator__item').forEach(el => {
      const s = parseInt(el.dataset.step);
      el.className = 'step-indicator__item';
      if (s === step) el.classList.add('step-indicator__item--active');
      else if (s < step) el.classList.add('step-indicator__item--completed');
    });
    currentStep = step;
  };

  window.prevStep = (step) => {
    document.querySelectorAll('.reg-step').forEach(el => el.classList.add('hidden'));
    document.querySelector(`.reg-step[data-step="${step}"]`)?.classList.remove('hidden');
    document.querySelectorAll('.step-indicator__item').forEach(el => {
      const s = parseInt(el.dataset.step);
      el.className = 'step-indicator__item';
      if (s === step) el.classList.add('step-indicator__item--active');
      else if (s < step) el.classList.add('step-indicator__item--completed');
    });
    currentStep = step;
  };

  window.togglePassword = (id, btn) => PasswordUtils.toggleVisibility(id, btn);

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => AuthModule.init());
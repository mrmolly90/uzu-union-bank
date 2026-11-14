/* ==========================================================================
   UZU UNION BANK — Authentication Module
   Login/Register with client-side validation, password strength meter,
   multi-step KYC onboarding, and simulated JWT auth.
   ========================================================================== */

(function () {
  'use strict';

  /* --------------------------------------------------------------------
     DOM References
     -------------------------------------------------------------------- */
  var tabLogin     = document.getElementById('tabLogin');
  var tabRegister  = document.getElementById('tabRegister');
  var formLogin    = document.getElementById('formLogin');
  var formRegister = document.getElementById('formRegister');
  var loginForm    = document.getElementById('loginForm');
  var registerForm = document.getElementById('registerForm');
  var loginSubmit  = document.getElementById('loginSubmit');
  var regSubmit    = document.getElementById('regSubmit');

  /* --------------------------------------------------------------------
     Tab Switching
     -------------------------------------------------------------------- */
  function switchTab(tab) {
    try {
      // Update tab styles
      document.querySelectorAll('.auth-tab').forEach(function (t) {
        t.classList.remove('bg-uzu-emerald', 'text-uzu-950', 'shadow-lg', 'shadow-uzu-emerald/20');
        t.classList.add('text-gray-400');
      });
      var activeTab = tab === 'login' ? tabLogin : tabRegister;
      activeTab.classList.remove('text-gray-400');
      activeTab.classList.add('bg-uzu-emerald', 'text-uzu-950', 'shadow-lg', 'shadow-uzu-emerald/20');

      // Show/hide forms
      formLogin.classList.toggle('hidden', tab !== 'login');
      formRegister.classList.toggle('hidden', tab !== 'register');

      // Update URL hash
      window.location.hash = tab === 'register' ? 'register' : 'login';
    } catch (err) {
      console.error('[Auth] switchTab error:', err);
    }
  }

  if (tabLogin) tabLogin.addEventListener('click', function () { switchTab('login'); });
  if (tabRegister) tabRegister.addEventListener('click', function () { switchTab('register'); });

  // Check URL hash on load
  if (window.location.hash === '#register' && tabRegister) {
    switchTab('register');
  }

  /* --------------------------------------------------------------------
     Password Toggle
     -------------------------------------------------------------------- */
  window.togglePassword = function (inputId, btn) {
    try {
      var input = document.getElementById(inputId);
      if (!input) return;
      var isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      btn.innerHTML = isPassword ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
    } catch (err) {
      console.error('[Auth] togglePassword error:', err);
    }
  };

  /* --------------------------------------------------------------------
     Password Strength Meter
     -------------------------------------------------------------------- */
  function evaluatePasswordStrength(password) {
    var score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return Math.min(score, 4);
  }

  function updatePasswordStrength(password) {
    var bars = document.querySelectorAll('#passwordStrength .password-strength__bar');
    var text = document.getElementById('passwordStrengthText');
    if (!bars.length || !text) return;

    var score = evaluatePasswordStrength(password);
    var levels = ['', 'Weak', 'Weak', 'Medium', 'Strong', 'Very Strong'];
    var classes = ['', 'weak', 'weak', 'medium', 'strong', 'strong'];

    bars.forEach(function (bar, i) {
      bar.className = 'password-strength__bar';
      if (i < score) {
        bar.classList.add('password-strength__bar--' + classes[score]);
      }
    });

    text.textContent = score > 0 ? 'Strength: ' + levels[score] : '';
    text.style.color = score <= 2 ? '#EF4444' : score === 3 ? '#F59E0B' : '#10B981';
  }

  var regPassword = document.getElementById('regPassword');
  if (regPassword) {
    regPassword.addEventListener('input', function () {
      updatePasswordStrength(this.value);
    });
  }

  /* --------------------------------------------------------------------
     Multi-step Registration
     -------------------------------------------------------------------- */
  var currentStep = 1;

  window.nextStep = function (step) {
    try {
      // Validate current step fields
      var currentEl = document.querySelector('.reg-step[data-step="' + currentStep + '"]');
      var inputs = currentEl ? currentEl.querySelectorAll('input[required], select[required]') : [];
      var valid = true;
      inputs.forEach(function (input) {
        if (!input.value.trim()) {
          input.style.borderColor = '#EF4444';
          valid = false;
        } else {
          input.style.borderColor = '';
        }
      });
      if (!valid) {
        showError('Please fill in all required fields.');
        return;
      }

      // Hide current, show next
      document.querySelectorAll('.reg-step').forEach(function (el) { el.classList.add('hidden'); });
      var nextEl = document.querySelector('.reg-step[data-step="' + step + '"]');
      if (nextEl) nextEl.classList.remove('hidden');

      // Update step indicator
      document.querySelectorAll('.step-indicator__item').forEach(function (el) {
        var s = parseInt(el.getAttribute('data-step'));
        el.className = 'step-indicator__item';
        if (s === step) el.classList.add('step-indicator__item--active');
        else if (s < step) el.classList.add('step-indicator__item--completed');
      });

      currentStep = step;
    } catch (err) {
      console.error('[Auth] nextStep error:', err);
    }
  };

  window.prevStep = function (step) {
    try {
      document.querySelectorAll('.reg-step').forEach(function (el) { el.classList.add('hidden'); });
      var prevEl = document.querySelector('.reg-step[data-step="' + step + '"]');
      if (prevEl) prevEl.classList.remove('hidden');

      document.querySelectorAll('.step-indicator__item').forEach(function (el) {
        var s = parseInt(el.getAttribute('data-step'));
        el.className = 'step-indicator__item';
        if (s === step) el.classList.add('step-indicator__item--active');
        else if (s < step) el.classList.add('step-indicator__item--completed');
      });

      currentStep = step;
    } catch (err) {
      console.error('[Auth] prevStep error:', err);
    }
  };

  /* --------------------------------------------------------------------
     Toast Notification
     -------------------------------------------------------------------- */
  function showToast(message, type) {
    type = type || 'info';
    var container = document.getElementById('toastContainer');
    if (!container) {
      // Create toast container if not exists
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none';
      document.body.appendChild(container);
    }
    var toast = document.createElement('div');
    var bgMap = { success: 'rgba(16,185,129,0.15)', error: 'rgba(239,68,68,0.15)', info: 'rgba(0,240,255,0.1)' };
    var borderMap = { success: 'rgba(16,185,129,0.3)', error: 'rgba(239,68,68,0.3)', info: 'rgba(0,240,255,0.2)' };
    var colorMap = { success: '#10B981', error: '#EF4444', info: '#00F0FF' };
    toast.style.cssText = 'display:flex;align-items:center;gap:8px;padding:12px 20px;border-radius:12px;font-size:0.85rem;font-weight:500;pointer-events:auto;animation:toast-in 0.3s ease-out;min-width:280px;max-width:420px;background:' + (bgMap[type] || bgMap.info) + ';border:1px solid ' + (borderMap[type] || borderMap.info) + ';color:' + (colorMap[type] || colorMap.info) + ';';
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 5000);
  }

  function showError(msg) { showToast(msg, 'error'); }
  function showSuccess(msg) { showToast(msg, 'success'); }

  /* --------------------------------------------------------------------
     Login Handler — POST /api/auth/login
     -------------------------------------------------------------------- */
  if (loginForm) {
    loginForm.addEventListener('submit', function (e) {
      e.preventDefault();

      var email = document.getElementById('loginEmail').value.trim();
      var password = document.getElementById('loginPassword').value;
      var emailErr = document.getElementById('loginEmailError');
      var passErr = document.getElementById('loginPasswordError');

      // Reset errors
      if (emailErr) emailErr.classList.add('hidden');
      if (passErr) passErr.classList.add('hidden');
      document.getElementById('loginEmail').style.borderColor = '';
      document.getElementById('loginPassword').style.borderColor = '';

      var valid = true;

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        if (emailErr) emailErr.classList.remove('hidden');
        document.getElementById('loginEmail').style.borderColor = '#EF4444';
        valid = false;
      }
      if (!password) {
        if (passErr) passErr.classList.remove('hidden');
        document.getElementById('loginPassword').style.borderColor = '#EF4444';
        valid = false;
      }

      if (!valid) {
        loginForm.classList.add('shake');
        setTimeout(function () { loginForm.classList.remove('shake'); }, 500);
        return;
      }

      // Real API call
      loginSubmit.disabled = true;
      loginSubmit.querySelector('#loginSubmitText').innerHTML = '<span class="spinner"></span> Signing In…';

      fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, password: password })
      })
      .then(function (res) {
        if (!res.ok) {
          return res.json().then(function (data) { throw new Error(data.error || 'Invalid credentials.'); });
        }
        return res.json();
      })
      .then(function (data) {
        // Store token in sessionStorage (memory-only pattern)
        sessionStorage.setItem('uzu_token', data.token);
        sessionStorage.setItem('uzu_user', JSON.stringify(data.user));
        showSuccess('Welcome back, ' + data.user.fullName + '! Redirecting…');
        setTimeout(function () {
          window.location.href = '/dashboard.html';
        }, 1000);
      })
      .catch(function (err) {
        showError(err.message || 'Login failed. Please try again.');
        loginForm.classList.add('shake');
        setTimeout(function () { loginForm.classList.remove('shake'); }, 500);
      })
      .finally(function () {
        loginSubmit.disabled = false;
        loginSubmit.querySelector('#loginSubmitText').textContent = 'Sign In';
      });
    });
  }

  /* --------------------------------------------------------------------
     Registration Handler — POST /api/auth/register
     -------------------------------------------------------------------- */
  if (registerForm) {
    registerForm.addEventListener('submit', function (e) {
      e.preventDefault();

      var email = document.getElementById('regEmail').value.trim();
      var password = document.getElementById('regPassword').value;
      var confirm = document.getElementById('regConfirm').value;
      var bankPin = document.getElementById('regBankPin').value;
      var confirmBankPin = document.getElementById('regConfirmBankPin').value;
      var fullName = document.getElementById('regFullName').value.trim();
      var country = document.getElementById('regCountry').value;
      var compliance = document.getElementById('regCompliance');

      if (password !== confirm) {
        showError('Passwords do not match.');
        return;
      }

      if (password.length < 5) {
        showError('Password must be at least 5 characters.');
        return;
      }

      if (!/^\d{4}$/.test(bankPin)) {
        showError('Bank PIN must be exactly 4 digits.');
        return;
      }

      if (bankPin !== confirmBankPin) {
        showError('Bank PINs do not match.');
        return;
      }

      if (!compliance || !compliance.checked) {
        showError('Please accept the Terms of Service and AML/CTF compliance requirements.');
        return;
      }

      // Real API call
      regSubmit.disabled = true;
      regSubmit.querySelector('#regSubmitText').innerHTML = '<span class="spinner"></span> Creating Account…';

      fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          password: password,
          bankPin: bankPin,
          fullName: fullName,
          country: country
        })
      })
      .then(function (res) {
        if (!res.ok) {
          return res.json().then(function (data) { throw new Error(data.error || 'Registration failed.'); });
        }
        return res.json();
      })
      .then(function (data) {
        sessionStorage.setItem('uzu_token', data.token);
        sessionStorage.setItem('uzu_user', JSON.stringify(data.user));
        showSuccess('Account created successfully! Welcome to Uzu Union Bank.');
        // Reset and switch to login
        registerForm.reset();
        document.querySelectorAll('.reg-step').forEach(function (el) { el.classList.add('hidden'); });
        document.querySelector('.reg-step[data-step="1"]').classList.remove('hidden');
        currentStep = 1;
        document.querySelectorAll('.step-indicator__item').forEach(function (el) {
          el.className = 'step-indicator__item';
          if (parseInt(el.getAttribute('data-step')) === 1) el.classList.add('step-indicator__item--active');
        });
        setTimeout(function () { switchTab('login'); }, 1500);
      })
      .catch(function (err) {
        showError(err.message || 'Registration failed. Please try again.');
      })
      .finally(function () {
        regSubmit.disabled = false;
        regSubmit.querySelector('#regSubmitText').textContent = 'Create Secure Account';
      });
    });
  }

  /* --------------------------------------------------------------------
     Spinner CSS injection
     -------------------------------------------------------------------- */
  var style = document.createElement('style');
  style.textContent = '@keyframes spin { to { transform: rotate(360deg); } } .spinner { display:inline-block; width:16px; height:16px; border:2px solid rgba(255,255,255,0.2); border-top-color:#fff; border-radius:50%; animation:spin 0.6s linear infinite; vertical-align:middle; } @keyframes toast-in { from { transform:translateX(100%); opacity:0; } to { transform:translateX(0); opacity:1; } }';
  document.head.appendChild(style);

  console.log('[Auth] Module initialized.');
})();
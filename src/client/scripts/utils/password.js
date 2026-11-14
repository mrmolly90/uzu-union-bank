/* ==========================================================================
   UZU UNION BANK — Password Utilities
   Strength evaluation, toggle visibility, validation.
   ========================================================================== */

const PasswordUtils = (() => {
  function evaluateStrength(password) {
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return Math.min(score, 4);
  }

  function getStrengthLabel(score) {
    const labels = ['', 'Weak', 'Weak', 'Medium', 'Strong', 'Very Strong'];
    return labels[score] || '';
  }

  function getStrengthClass(score) {
    if (score <= 2) return 'weak';
    if (score === 3) return 'medium';
    return 'strong';
  }

  function updateStrengthMeter(password, barContainer, textEl) {
    const score = evaluateStrength(password);
    const bars = barContainer?.querySelectorAll('.password-strength__bar');
    if (bars) {
      bars.forEach((bar, i) => {
        bar.className = 'password-strength__bar';
        if (i < score) {
          bar.classList.add(`password-strength__bar--${getStrengthClass(score)}`);
        }
      });
    }
    if (textEl) {
      textEl.textContent = score > 0 ? `Strength: ${getStrengthLabel(score)}` : '';
      textEl.style.color = score <= 2 ? '#EF4444' : score === 3 ? '#F59E0B' : '#10B981';
    }
    return score;
  }

  function toggleVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    if (btn) {
      btn.innerHTML = isPassword
        ? '<i class="fa-solid fa-eye-slash"></i>'
        : '<i class="fa-solid fa-eye"></i>';
    }
  }

  return { evaluateStrength, updateStrengthMeter, toggleVisibility };
})();
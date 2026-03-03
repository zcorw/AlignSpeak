document.addEventListener("DOMContentLoaded", () => {
  document.body.classList.add("ready");

  const levelInput = document.querySelector("#mask-level");
  const levelText = document.querySelector("#mask-level-text");
  const maskedTokens = Array.from(document.querySelectorAll(".token.masked"));

  if (levelInput && levelText && maskedTokens.length) {
    const applyMask = () => {
      const level = Number(levelInput.value);
      const ratio = [0, 0.2, 0.4, 0.7, 0.9][level];
      const visibleCount = Math.max(0, Math.floor(maskedTokens.length * (1 - ratio)));

      maskedTokens.forEach((token, i) => {
        token.style.color = i < visibleCount ? "#1d2a2f" : "transparent";
      });

      levelText.textContent = `Level ${level}`;
    };

    levelInput.addEventListener("input", applyMask);
    applyMask();
  }

  const tabButtons = Array.from(document.querySelectorAll(".tab-btn[data-target]"));
  const screens = Array.from(document.querySelectorAll("[data-screen]"));
  let switchScreen = null;

  if (tabButtons.length && screens.length) {
    switchScreen = (targetId) => {
      screens.forEach((screen) => {
        screen.classList.toggle("is-active", screen.id === targetId);
      });
      tabButtons.forEach((btn) => {
        btn.classList.toggle("is-active", btn.dataset.target === targetId);
      });
    };

    tabButtons.forEach((btn) => {
      btn.addEventListener("click", () => switchScreen(btn.dataset.target));
    });
  }

  const quickOpenButtons = Array.from(document.querySelectorAll("[data-open-screen]"));
  if (quickOpenButtons.length && switchScreen) {
    quickOpenButtons.forEach((button) => {
      button.addEventListener("click", () => {
        switchScreen(button.dataset.openScreen);
      });
    });
  }

  const switchWrappers = Array.from(document.querySelectorAll("[data-practice-switch]"));

  switchWrappers.forEach((wrapper) => {
    const buttons = Array.from(wrapper.querySelectorAll(".mode-btn[data-practice-target]"));
    const card = wrapper.closest(".card");
    if (!card || !buttons.length) return;

    const states = Array.from(card.querySelectorAll("[data-practice-state]"));
    if (!states.length) return;

    const switchState = (targetId) => {
      states.forEach((state) => {
        state.classList.toggle("is-active", state.id === targetId);
      });
      buttons.forEach((button) => {
        button.classList.toggle("is-active", button.dataset.practiceTarget === targetId);
      });
    };

    buttons.forEach((button) => {
      button.addEventListener("click", () => switchState(button.dataset.practiceTarget));
    });
  });
});

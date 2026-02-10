import {Page} from '@playwright/test';

// Adds runtime data-testid hooks to the Contact Center sample app so the
// cc-playwright-kit selectors can target a consistent surface without
// modifying the sample source files.

/**
 * Injects a script into the Contact Center sample application so that it exposes
 * the data-testid hooks expected by the cc-playwright-kit suite.
 */
export async function injectContactCenterTestIds(page: Page) {
  await page.addInitScript(() => {
    const ready = (fn: () => void) => {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fn, {once: true});
      } else {
        fn();
      }
    };

    const assignTestId = (selector: string, testId: string) => {
      const el = document.querySelector<HTMLElement>(selector);
      if (el) {
        el.setAttribute('data-testid', testId);
      }
    };

    const waitForGlobal = (prop: string, cb: (value: any) => void) => {
      const globalAny = window as any;
      if (typeof globalAny[prop] === 'function') {
        cb(globalAny[prop]);
        return;
      }
      const interval = window.setInterval(() => {
        if (typeof globalAny[prop] === 'function') {
          window.clearInterval(interval);
          cb(globalAny[prop]);
        }
      }, 100);
    };

    const setupHideDesktopToggle = () => {
      const agentLogin = document.getElementById('AgentLogin');
      const fieldset = agentLogin?.closest('fieldset');
      if (!fieldset || fieldset.querySelector('[data-testid="samples:hide-desktop-login-checkbox"]')) {
        return;
      }
      const wrapper = document.createElement('label');
      wrapper.style.display = 'block';
      wrapper.style.marginTop = '8px';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.setAttribute('data-testid', 'samples:hide-desktop-login-checkbox');
      wrapper.appendChild(checkbox);
      wrapper.appendChild(document.createTextNode(' Hide Desktop login option'));
      fieldset.appendChild(wrapper);

      checkbox.addEventListener('change', () => {
        const select = document.getElementById('AgentLogin') as HTMLSelectElement | null;
        if (!select) return;
        Array.from(select.options).forEach((option) => {
          if (option.value === 'BROWSER') {
            option.hidden = checkbox.checked;
            if (checkbox.checked && select.value === option.value) {
              select.value = '';
            }
          }
        });
      });
    };

    const setupStateIndicator = () => {
      const idleDropdown = document.getElementById('idleCodesDropdown');
      if (!idleDropdown || document.querySelector('[data-testid="state-select"]')) {
        return;
      }
      const wrapper = document.createElement('div');
      wrapper.setAttribute('data-testid', 'state-select');
      wrapper.style.cursor = 'pointer';
      wrapper.style.marginBottom = '8px';
      const stateLabel = document.createElement('span');
      stateLabel.setAttribute('data-testid', 'state-name');
      stateLabel.textContent =
        (idleDropdown as HTMLSelectElement).selectedOptions?.[0]?.text ?? (idleDropdown as HTMLSelectElement).value ?? '';
      wrapper.appendChild(stateLabel);
      idleDropdown.parentElement?.insertBefore(wrapper, idleDropdown);

      wrapper.addEventListener('click', () => {
        const globalAny = window as any;
        if (typeof globalAny.showAgentStatePopup === 'function') {
          globalAny.showAgentStatePopup('');
        }
      });

      idleDropdown.addEventListener('change', () => {
        const select = idleDropdown as HTMLSelectElement;
        stateLabel.textContent = select.selectedOptions?.[0]?.text ?? select.value ?? '';
      });
    };

    const patchStatePopup = () => {
      const annotateStateOptions = () => {
        const select = document.getElementById('agentStateSelect') as HTMLSelectElement | null;
        if (!select) return;
        Array.from(select.options).forEach((option) => {
          const label = option.text?.trim() ?? option.value;
          option.setAttribute('data-testid', `state-item-${label}`);
        });
      };
      waitForGlobal('showAgentStatePopup', (original: (...args: any[]) => void) => {
        const globalAny = window as any;
        if (globalAny.__patchedShowAgentStatePopup) return;
        globalAny.__patchedShowAgentStatePopup = true;
        globalAny.showAgentStatePopup = (...args: any[]) => {
          original(...args);
          window.setTimeout(annotateStateOptions, 0);
        };
      });
    };

    const setupIncomingMirrors = () => {
      const incomingRoot = document.getElementById('incomingsection');
      const statusNode = document.getElementById('incoming-task');
      if (!incomingRoot || !statusNode) return;

      const createMirror = (testId: string) => {
        let mirror = incomingRoot.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
        if (!mirror) {
          mirror = document.createElement('div');
          mirror.setAttribute('data-testid', testId);
          mirror.style.display = 'none';
          mirror.style.marginTop = '4px';
          mirror.style.fontWeight = 'bold';
          incomingRoot.appendChild(mirror);
        }
        return mirror;
      };

      const mirrors = {
        telephony: createMirror('samples:incoming-task-telephony'),
        chat: createMirror('samples:incoming-task-chat'),
        email: createMirror('samples:incoming-task-email'),
      };

      const updateMirrors = () => {
        const text = statusNode.textContent ?? '';
        Object.values(mirrors).forEach((node) => {
          node.style.display = 'none';
        });
        if (/Call from/i.test(text)) {
          mirrors.telephony.textContent = text;
          mirrors.telephony.style.display = 'block';
        } else if (/Chat from/i.test(text)) {
          mirrors.chat.textContent = text;
          mirrors.chat.style.display = 'block';
        } else if (/Email from/i.test(text)) {
          mirrors.email.textContent = text;
          mirrors.email.style.display = 'block';
        }
      };

      const observer = new MutationObserver(updateMirrors);
      observer.observe(statusNode, {subtree: true, characterData: true, childList: true});
      updateMirrors();
    };

    const observeTimer = () => {
      const timer = document.getElementById('timerDisplay');
      if (!timer) return;
      timer.setAttribute('data-testid', 'cc-cad:call-timer');
      let mirror = timer.nextElementSibling as HTMLElement | null;
      if (!mirror || mirror.getAttribute('data-testid') !== 'elapsed-time') {
        mirror = document.createElement('div');
        mirror.setAttribute('data-testid', 'elapsed-time');
        mirror.style.marginTop = '4px';
        timer.insertAdjacentElement('afterend', mirror);
      }
      const update = () => {
        mirror!.textContent = timer.textContent ?? '';
      };
      const observer = new MutationObserver(update);
      observer.observe(timer, {childList: true, characterData: true, subtree: true});
      update();
    };

    const observeTaskList = () => {
      const container = document.getElementById('taskList');
      if (!container) return;
      container.setAttribute('data-testid', 'task-list');
      const annotate = () => {
        container.querySelectorAll<HTMLElement>('.task-item').forEach((item) => {
          const title = item.querySelector<HTMLElement>('p');
          title?.setAttribute('data-testid', 'task:title');
          item.querySelectorAll<HTMLButtonElement>('button.accept-task').forEach((btn) => {
            btn.setAttribute('data-testid', 'task:accept-button');
          });
          item.querySelectorAll<HTMLButtonElement>('button.decline-task').forEach((btn) => {
            btn.setAttribute('data-testid', 'task:decline-button');
          });
        });
      };
      const observer = new MutationObserver(annotate);
      observer.observe(container, {childList: true, subtree: true});
      annotate();
    };

    ready(() => {
      assignTestId('#callcontrolsection', 'call-control-container');
      assignTestId('#consult', 'call-control:consult');
      assignTestId('#end', 'call-control:end-call');
      assignTestId('#hold-resume', 'call-control:hold-toggle');
      assignTestId('#pause-resume-recording', 'call-control:recording-toggle');
      assignTestId('#transfer', 'call-control:transfer');
      assignTestId('#wrapup', 'call-control:wrapup-button');
      assignTestId('#wrapupCodesDropdown', 'call-control:wrapup-select');
      assignTestId('#end-consult', 'cancel-consult-btn');
      assignTestId('#dialNumber', 'dial-number-input');
      assignTestId('#loginAgent', 'login-button');
      assignTestId('#AgentLogin', 'login-option-select');
      assignTestId('#teamsDropdown', 'teams-select-dropdown');
      assignTestId('#logoutAgent', 'samples:station-logout-button');
      assignTestId('#agentStatePopup', 'samples:rona-popup');
      assignTestId('#agentStateSelect', 'samples:rona-select-state');
      assignTestId('#setAgentState', 'samples:rona-button-confirm');
      assignTestId('#taskList', 'task-list');
      assignTestId('#consult-transfer', 'transfer-consult-btn');
      const stationFieldset = document.getElementById('loginAgent')?.closest('fieldset');
      stationFieldset?.setAttribute('data-testid', 'station-login-widget');

      setupHideDesktopToggle();
      setupStateIndicator();
      patchStatePopup();
      setupIncomingMirrors();
      observeTimer();
      observeTaskList();
    });
  });
}

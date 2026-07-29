import {Page, expect} from '@playwright/test';
import {OPERATION_TIMEOUT} from '../constants';

export async function executeConsultTransfer(page: Page): Promise<void> {
  await page.bringToFront();

  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const globalScope = globalThis as typeof globalThis & {
            currentTask?: any;
            consultationData?: {to?: string; destinationType?: string};
            toggleTransferOptions?: () => Promise<void> | void;
            initiateConsultTransfer?: () => Promise<void> | void;
          };
          const task = globalScope.currentTask;
          const consultTransferBtn = document.querySelector(
            '#consult-transfer'
          ) as HTMLButtonElement | null;
          const consultDestinationInput = document.querySelector(
            '#consultDestination, #consult-destination'
          ) as HTMLInputElement | HTMLSelectElement | null;
          const consultDestinationType = document.querySelector(
            '#consult-destination-type'
          ) as HTMLSelectElement | null;
          const consultationData = globalScope.consultationData;
          const domConsultTarget = consultDestinationInput?.value?.trim() || '';
          const domConsultDestinationType = consultDestinationType?.value || '';
          const payloadTarget = consultationData?.to || domConsultTarget;
          const payloadDestinationType =
            consultationData?.destinationType || domConsultDestinationType;
          const fallbackTarget = task?.data?.destAgentId || task?.data?.consultingAgentId || '';
          const canUseHiddenConsultTransfer =
            Boolean(consultTransferBtn) &&
            !consultTransferBtn?.disabled &&
            Boolean(domConsultTarget) &&
            Boolean(domConsultDestinationType);
          const canUsePayloadTransfer =
            typeof task?.transfer === 'function' &&
            Boolean(payloadTarget) &&
            Boolean(payloadDestinationType);
          const canUseConferenceTransfer =
            task?.data?.isConferenceInProgress === true &&
            typeof task?.transferConference === 'function';
          const canUseVisibleTransfer = (() => {
            const transferBtn = document.querySelector('#transfer') as HTMLButtonElement | null;
            if (!transferBtn || transferBtn.disabled) {
              return false;
            }

            const style = window.getComputedStyle(transferBtn);

            return (
              transferBtn.offsetParent !== null &&
              style.display !== 'none' &&
              style.visibility !== 'hidden' &&
              (Boolean(fallbackTarget) || canUseConferenceTransfer)
            );
          })();
          const canUseFunctionTransfer =
            (typeof globalScope.toggleTransferOptions === 'function' ||
              typeof globalScope.initiateConsultTransfer === 'function') &&
            (Boolean(domConsultTarget && domConsultDestinationType) ||
              Boolean(fallbackTarget) ||
              canUseConferenceTransfer);

          return (
            canUseHiddenConsultTransfer ||
            canUsePayloadTransfer ||
            canUseConferenceTransfer ||
            canUseVisibleTransfer ||
            canUseFunctionTransfer
          );
        }),
      {timeout: OPERATION_TIMEOUT, intervals: [500, 1000, 2000]}
    )
    .toBeTruthy();

  const transferResult = await page.evaluate(async (operationTimeout) => {
    const globalScope = globalThis as typeof globalThis & {
      currentTask?: any;
      consultationData?: {to?: string; destinationType?: string};
      toggleTransferOptions?: () => Promise<void> | void;
      initiateConsultTransfer?: () => Promise<void> | void;
    };
    const task = globalScope.currentTask;
    const consultTransferBtn = document.querySelector(
      '#consult-transfer'
    ) as HTMLButtonElement | null;
    const consultDestinationInput = document.querySelector(
      '#consultDestination, #consult-destination'
    ) as HTMLInputElement | HTMLSelectElement | null;
    const consultDestinationType = document.querySelector(
      '#consult-destination-type'
    ) as HTMLSelectElement | null;
    const transferBtn = document.querySelector('#transfer') as HTMLButtonElement | null;
    const errors: string[] = [];

    const errorMessage = (error: unknown): string =>
      error instanceof Error ? error.message : String(error);

    const withTimeout = async <T>(operation: Promise<T> | T, label: string): Promise<T> => {
      let timeoutId: number | undefined;

      try {
        return await Promise.race([
          Promise.resolve(operation),
          new Promise<T>((_, reject) => {
            timeoutId = window.setTimeout(
              () => reject(new Error(`${label} timed out after ${operationTimeout}ms`)),
              operationTimeout
            );
          }),
        ]);
      } finally {
        if (timeoutId !== undefined) {
          window.clearTimeout(timeoutId);
        }
      }
    };

    const runStrategy = async (
      strategy: string,
      action: () => Promise<void> | void
    ): Promise<{ok: boolean; strategy: string} | null> => {
      const alerts: string[] = [];
      const consoleErrors: string[] = [];
      const originalAlert = window.alert;
      const originalConsoleError = console.error;

      try {
        window.alert = (message?: unknown) => {
          alerts.push(String(message ?? ''));
        };
        console.error = (...args: unknown[]) => {
          consoleErrors.push(args.map(errorMessage).join(' '));
          originalConsoleError.apply(console, args);
        };

        await withTimeout(action(), strategy);
        const reportedFailure = [...alerts, ...consoleErrors].find((message) =>
          /failed|not ready|please enter|please try|error/i.test(message)
        );

        if (reportedFailure) {
          throw new Error(reportedFailure);
        }

        return {ok: true, strategy};
      } catch (error) {
        errors.push(`${strategy}: ${errorMessage(error)}`);

        return null;
      } finally {
        window.alert = originalAlert;
        console.error = originalConsoleError;
      }
    };

    const isVisibleEnabled = (btn: HTMLButtonElement | null): boolean => {
      if (!btn || btn.disabled) {
        return false;
      }

      const style = window.getComputedStyle(btn);

      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0' &&
        btn.offsetParent !== null
      );
    };

    const invokeButton = async (btn: HTMLButtonElement, strategy: string): Promise<void> => {
      if (btn.onclick) {
        const result = btn.onclick(new MouseEvent('click'));
        if (result && typeof result.then === 'function') {
          await withTimeout(result, strategy);
        }

        return;
      }

      btn.click();
    };

    const tryTransferWithPayload = async (
      transferTo: string,
      destinationType: string,
      strategy: string
    ): Promise<{ok: boolean; strategy: string} | null> => {
      if (!task?.transfer || !transferTo || !destinationType) {
        return null;
      }

      return runStrategy(strategy, () =>
        task.transfer({
          to: transferTo,
          destinationType,
        })
      );
    };

    try {
      const consultationData = globalScope.consultationData;
      const domConsultTarget = consultDestinationInput?.value?.trim() || '';
      const domConsultDestinationType = consultDestinationType?.value || '';
      const payloadTarget = consultationData?.to || domConsultTarget || '';
      const payloadDestinationType =
        consultationData?.destinationType || domConsultDestinationType || '';
      const fallbackTarget = task?.data?.destAgentId || task?.data?.consultingAgentId || '';
      const fallbackDestinationType = task?.data?.destinationType || 'agent';
      const canUseDomConsultTransfer =
        Boolean(domConsultTarget) && Boolean(domConsultDestinationType);
      const canUseFallbackTransfer = Boolean(fallbackTarget) && Boolean(fallbackDestinationType);

      if (
        task?.data?.isConferenceInProgress === true &&
        typeof task?.transferConference === 'function'
      ) {
        const result = await runStrategy('task-transfer-conference', () =>
          task.transferConference()
        );
        if (result) {
          return result;
        }
      }

      const payloadTransferResult = await tryTransferWithPayload(
        payloadTarget,
        payloadDestinationType,
        'consultation-data-transfer'
      );
      if (payloadTransferResult) {
        return payloadTransferResult;
      }

      if (typeof globalScope.initiateConsultTransfer === 'function' && canUseDomConsultTransfer) {
        const result = await runStrategy('initiate-consult-transfer', () =>
          globalScope.initiateConsultTransfer!()
        );
        if (result) {
          return result;
        }
      }

      if (consultTransferBtn && !consultTransferBtn.disabled && canUseDomConsultTransfer) {
        const result = await runStrategy('hidden-consult-transfer-button', () =>
          invokeButton(consultTransferBtn, 'hidden-consult-transfer-button')
        );
        if (result) {
          return result;
        }
      }

      const taskTransferResult = await tryTransferWithPayload(
        fallbackTarget,
        fallbackDestinationType,
        'task-transfer'
      );
      if (taskTransferResult) {
        return taskTransferResult;
      }

      if (
        isVisibleEnabled(transferBtn) &&
        (canUseFallbackTransfer || task?.data?.isConferenceInProgress === true)
      ) {
        const result = await runStrategy('visible-transfer-button', () =>
          invokeButton(transferBtn!, 'visible-transfer-button')
        );
        if (result) {
          return result;
        }
      }

      if (
        typeof globalScope.toggleTransferOptions === 'function' &&
        (canUseFallbackTransfer || task?.data?.isConferenceInProgress === true)
      ) {
        const result = await runStrategy('toggle-transfer-options', () =>
          globalScope.toggleTransferOptions!()
        );
        if (result) {
          return result;
        }
      }

      return {
        ok: false,
        reason: errors.length
          ? 'No consult transfer action completed'
          : 'No consult transfer action was available',
        errors,
        payloadTarget,
        payloadDestinationType,
        fallbackTarget,
      };
    } catch (error) {
      return {
        ok: false,
        reason: errorMessage(error),
        errors,
      };
    }
  }, OPERATION_TIMEOUT);

  if (!transferResult.ok) {
    throw new Error(`Consult transfer could not be executed: ${JSON.stringify(transferResult)}`);
  }

  await page.waitForTimeout(2000);
}

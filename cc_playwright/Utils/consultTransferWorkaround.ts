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
          const consultDestinationInput = document.querySelector('#consult-destination') as
            | HTMLInputElement
            | HTMLSelectElement
            | null;
          const consultDestinationType = document.querySelector(
            '#consult-destination-type'
          ) as HTMLSelectElement | null;
          const consultationData = globalScope.consultationData;
          const payloadTarget =
            consultationData?.to || consultDestinationInput?.value?.trim() || '';
          const payloadDestinationType =
            consultationData?.destinationType || consultDestinationType?.value || '';
          const canUseHiddenConsultTransfer =
            Boolean(consultTransferBtn) && !consultTransferBtn?.disabled;
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
              style.visibility !== 'hidden'
            );
          })();

          return (
            canUseHiddenConsultTransfer ||
            canUsePayloadTransfer ||
            canUseConferenceTransfer ||
            canUseVisibleTransfer ||
            typeof globalScope.toggleTransferOptions === 'function' ||
            typeof globalScope.initiateConsultTransfer === 'function'
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
    const consultDestinationInput = document.querySelector('#consult-destination') as
      | HTMLInputElement
      | HTMLSelectElement
      | null;
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
      try {
        await withTimeout(action(), strategy);

        return {ok: true, strategy};
      } catch (error) {
        errors.push(`${strategy}: ${errorMessage(error)}`);

        return null;
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

      const consultationData = globalScope.consultationData;
      const payloadTarget = consultationData?.to || consultDestinationInput?.value?.trim() || '';
      const payloadDestinationType =
        consultationData?.destinationType || consultDestinationType?.value || '';
      const payloadTransferResult = await tryTransferWithPayload(
        payloadTarget,
        payloadDestinationType,
        'consultation-data-transfer'
      );
      if (payloadTransferResult) {
        return payloadTransferResult;
      }

      if (typeof globalScope.initiateConsultTransfer === 'function') {
        const result = await runStrategy('initiate-consult-transfer', () =>
          globalScope.initiateConsultTransfer!()
        );
        if (result) {
          return result;
        }
      }

      if (consultTransferBtn && !consultTransferBtn.disabled) {
        const result = await runStrategy('hidden-consult-transfer-button', () =>
          invokeButton(consultTransferBtn, 'hidden-consult-transfer-button')
        );
        if (result) {
          return result;
        }
      }

      const fallbackTarget = task?.data?.destAgentId || task?.data?.consultingAgentId || '';
      const fallbackDestinationType = task?.data?.destinationType || 'agent';
      const taskTransferResult = await tryTransferWithPayload(
        fallbackTarget,
        fallbackDestinationType,
        'task-transfer'
      );
      if (taskTransferResult) {
        return taskTransferResult;
      }

      if (isVisibleEnabled(transferBtn)) {
        const result = await runStrategy('visible-transfer-button', () =>
          invokeButton(transferBtn!, 'visible-transfer-button')
        );
        if (result) {
          return result;
        }
      }

      if (typeof globalScope.toggleTransferOptions === 'function') {
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

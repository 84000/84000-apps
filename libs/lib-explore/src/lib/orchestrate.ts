'use server';

import { lamaticClient } from './client';
import { config } from './config';
import {
  FlowResult,
  InputSchemaKey,
  Message,
  OutputSchemaKey,
  StepResult,
} from './types';

export async function orchestratePipelineStep(
  query: string,
  history: Message[],
  step: 'step1',
  previousResults?: FlowResult,
): Promise<StepResult> {
  const { flows } = config;

  try {
    const flow = flows[step];

    if (!flow) {
      throw new Error(`Step ${step} not found in configuration`);
    }

    console.log(`[v0] Executing ${step}: ${flow.name}`);

    const inputs: Record<string, unknown> = {};

    // Fill inputs based on schema
    for (const inputKey of Object.keys(flow.inputSchema)) {
      if (inputKey === 'chatMessage') {
        inputs[inputKey] = query;
      } else if (inputKey === 'chatHistory') {
        inputs[inputKey] = history;
      } else if (previousResults) {
        // Try to map from previous results
        for (const [, prevResult] of Object.entries(previousResults)) {
          const prevRecord = prevResult as Record<InputSchemaKey, unknown>;
          const schemaKey = inputKey as InputSchemaKey;

          if (prevResult && prevRecord[schemaKey]) {
            inputs[inputKey] = prevResult[schemaKey];
            break;
          }
        }
      }
    }

    console.log(`[v0] ${step} inputs:`, inputs);

    const resData = await lamaticClient.executeFlow(flow.workflowId, inputs);
    console.log(`[v0] ${step} raw response:`, resData);

    const output: Message = {
      role: 'assistant',
      content: '',
    };

    // Store declared outputs
    for (const key of Object.keys(flow.outputSchema)) {
      const schemaKey = key as OutputSchemaKey;
      if (resData?.result && resData.result[schemaKey] !== undefined) {
        output[schemaKey] = resData.result[schemaKey];
      }
    }

    console.log(`[v0] ${step} completed:`, output);

    return {
      success: true,
      stepId: step,
      stepName: flow.name,
      data: output,
    };
  } catch (error) {
    console.error(`[v0] Error executing ${step}:`, error);

    let errorMessage = 'Unknown error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
      // Provide more specific error messages for common issues
      if (error.message.includes('fetch failed')) {
        errorMessage =
          'Network error: Unable to connect to the service. Please check your internet connection and try again.';
      } else if (error.message.includes('API key')) {
        errorMessage =
          'Authentication error: Please check your API configuration.';
      }
    }

    return {
      success: false,
      stepId: step,
      stepName: flows[step]?.name || step,
      error: errorMessage,
    };
  }
}

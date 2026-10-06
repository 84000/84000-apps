import { POLICY_TOOL_NAMES as LIB_AGENT_POLICY_TOOL_NAMES } from '@eightyfourthousand/lib-agent';
import { POLICY_TOOL_NAMES } from './tool-names';

describe('POLICY_TOOL_NAMES', () => {
  it('mirrors the names lib-agent registers', () => {
    expect(POLICY_TOOL_NAMES).toEqual(LIB_AGENT_POLICY_TOOL_NAMES);
  });
});

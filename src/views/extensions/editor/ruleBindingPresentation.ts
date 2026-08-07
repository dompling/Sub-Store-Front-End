type RemoteRuleBindingLike = {
  kind: 'remote';
  name?: string;
};

export const getRemoteRuleBindingName = (rule?: RemoteRuleBindingLike) =>
  typeof rule?.name === 'string' ? rule.name.trim() : '';

export const setRemoteRuleBindingName = (
  rule: RemoteRuleBindingLike,
  value: string,
) => {
  const name = value.trim();
  if (name) rule.name = name;
  else delete rule.name;
};

export const getRemoteRuleActionTitle = (rule?: RemoteRuleBindingLike) => {
  const name = getRemoteRuleBindingName(rule);
  return name ? `RULE-SET · ${name}` : 'RULE-SET';
};

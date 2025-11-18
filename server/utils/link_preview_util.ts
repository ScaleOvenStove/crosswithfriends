const linkExpanderUserAgentSubstrings = {
  Discord: 'Discordbot',
  Slack: 'Slackbot-LinkExpanding',
  FB_Messenger: 'facebookexternalhit',
};

export function isFBMessengerCrawler(userAgent: string | undefined): boolean {
  if (!userAgent) return false;
  return userAgent.includes(linkExpanderUserAgentSubstrings.FB_Messenger);
}

export function isLinkExpanderBot(userAgent: string | undefined): boolean {
  if (!userAgent) return false;
  return Object.values(linkExpanderUserAgentSubstrings).some((ua) => userAgent.includes(ua));
}

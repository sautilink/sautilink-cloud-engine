# Testing

Telegram registry aliases: `/check`→audit, `/site`→website.  
`authorizeUser` returns allowed:true for public.  
Missing args must not call Cloud Engine.

Production API probes should remain HTTP 200 for valid public targets.

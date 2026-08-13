# Architecture

Email: `src/tools/email/{mx,spf,dmarc,dkim,score,index}.js`.

Flow: domain normalize → parallel DoH (MX/TXT, _dmarc TXT, DKIM) → analyzers → `calculateEmailSecurityScore` (pure, v1.0).

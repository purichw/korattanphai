export const lockedResourceField = key => /(?:id$|codes?$|slug$|^parent$|sha256|hash$|provenance|status|^type$|^version|schema|dataclass|sourceoftruth)/i.test(key);

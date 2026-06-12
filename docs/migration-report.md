# Migration report

Generated from src/data/deals.json (50 deals).

| Collection | Count |
|---|---|
| firms | 28 |
| funds | 49 |
| assets | 64 |
| deals | 50 |
| participants | 153 |
| stakes | 57 |

## Flags for review (38)

- [ ] firm enrichment skipped for compound "Madison Dearborn Partners + Catania Capital Partners" — assign firmType/aum manually
- [ ] firm enrichment skipped for compound "Oak Hill Capital + Pamlico Capital" — assign firmType/aum manually
- [ ] fund "N/A — family-owned conglomerate": no sponsor name match — defaulted to "Cox Enterprises", verify
- [ ] firm enrichment skipped for compound "DigitalBridge Group / Crestview Partners" — assign firmType/aum manually
- [ ] firm enrichment skipped for compound "Elliott Investment Management / Creditor Consortium" — assign firmType/aum manually
- [ ] firm enrichment skipped for compound "Apax Partners / Warburg Pincus / CPPIB Consortium" — assign firmType/aum manually
- [ ] fund "Secured lender consortium": no sponsor name match — defaulted to "E8 Partners", verify
- [ ] fund "N/A": no sponsor name match — defaulted to "Cox Enterprises", verify
- [ ] fund "N/A": no sponsor name match — defaulted to "Mediacom", verify
- [ ] fund "Stonepeak Infrastructure Fund IV" merged into "Stonepeak Infrastructure Partners IV" (key stonepeak-4) — verify same vehicle
- [ ] fund "Stonepeak Infrastructure Fund V" merged into "Stonepeak Infrastructure Partners V" (key stonepeak-5) — verify same vehicle
- [ ] firm enrichment skipped for compound "KKR & Co. / Ares Management" — assign firmType/aum manually
- [ ] firm enrichment skipped for compound "EQT Infrastructure / DigitalBridge (co-lead)" — assign firmType/aum manually
- [ ] deal-044: compound buyer "AT&T + T-Mobile + Verizon" split equally at 0.3333 — verify against deal terms
- [ ] deal-040: compound buyer "T-Mobile US + Oak Hill Capital" split equally at 0.5 — verify against deal terms
- [ ] deal-042: compound buyer "T-Mobile US + Wren House Infrastructure Management" split equally at 0.5 — verify against deal terms
- [ ] deal-038: compound buyer "T-Mobile US + Wren House Infrastructure Management" split equally at 0.5 — verify against deal terms
- [ ] deal-039: compound buyer "T-Mobile US + EQT Infrastructure (Lumos Networks JV)" split equally at 0.5 — verify against deal terms
- [ ] deal-041: compound buyer "T-Mobile US + KKR" split equally at 0.5 — verify against deal terms
- [ ] deal-041: buyer "KKR" fuzzy-matched to firm "KKR & Co. Inc." — verify
- [ ] deal-046: compound buyer "DigitalBridge Group + Crestview Partners" split equally at 0.5 — verify against deal terms
- [ ] deal-017: compound buyer "E8 Partners / Creditor Consortium" split equally at 0.5 — verify against deal terms
- [ ] deal-020: buyer "Mediacom Communications" fuzzy-matched to firm "Mediacom" — verify
- [ ] deal-030: buyer "Macquarie Infrastructure & Real Assets" fuzzy-matched to firm "Macquarie Asset Management" — verify
- [ ] deal-032: consolidation targets split: RCN Telecom | WaveDivision | Grande Communications — verify
- [ ] deal-034: compound buyer "EQT Infrastructure + Digital Colony Partners (DigitalBridge)" split equally at 0.5 — verify against deal terms
- [ ] deal-035: seller "(from T-Mobile post-Sprint merger)" not a known firm — review
- [ ] deal-036: synthesized pre-history stake for seller(s) on asset-wideopenwest-chicago-area-cable-system
- [ ] deal-008: synthesized pre-history stake for seller(s) on asset-wideopenwest-illinois-indiana-and-maryland-cable-systems
- [ ] deal-016: synthesized pre-history stake for seller(s) on asset-hargray-communications
- [ ] deal-027: synthesized pre-history stake for seller(s) on asset-inmarsat-holdings-ltd
- [ ] deal-020: synthesized pre-history stake for seller(s) on asset-vyve-broadband
- [ ] deal-039: partial deal (50%) — prior stakes on asset-lumos-networks left open, review
- [ ] deal-023: partial deal (70%) — prior stakes on asset-directv-llc left open, review
- [ ] deal-041: partial deal (50%) — prior stakes on asset-metronet left open, review
- [ ] deal-024: synthesized pre-history stake for seller(s) on asset-windstream-holdings
- [ ] deal-045: synthesized pre-history stake for seller(s) on asset-ziply-fiber
- [ ] deal-048: synthesized pre-history stake for seller(s) on asset-fastwyre-broadband

# ProNet

Samostatný pracovní prototyp konfigurátoru ochranných systémů a generátoru kusovníků.

Řešení `PLO-01` modeluje předepnutou lanovou obálku kvádrové budovy s plochou střechou. Obsahuje přesný referenční režim a oddělený parametrický generátor.

Řešení `MSK-01` modeluje silniční koridor z modulárních 6m stožárů podle podkladu NEtron NT-S-03. Výchozí parametrický režim `MSK-01-PARAM` umožňuje zadat délku, šířku a největší délku pole (pracovní výchozí hodnota 15 m). Oddělená pevná reference `MSK-01-REV03` reprodukuje dvě pole 15 × 6 × 6 m: 6 stožárů, 21 lanových úseků a 244,503 m geometrické délky lan. Přepnutí na referenci uchová vlastní zadání pro návrat.

Odvozené pravidlo `PRONET-ROAD-MAST-002` (nejde o pravidlo únosnosti převzaté z dokumentu): pro délku `L`, šířku `W` a největší délku pole `s` je počet polí `N = ceil(L/s)` a skutečná rozteč `d = L/N`. Celková délka zůstává přesně `L`. Výška zůstává 6 m a uvnitř průjezdného koridoru nejsou přidávány podpěry.

- Stožáry: `M = 2(N+1)`. Každý má 4 vlastní Y kolíky patky a 1 samostatný Y kolík kotevního lana 4 m vně krajní řady: celkem `5M` Y kompletů. Původní PDF tuto opravu patek nezahrnuje; reference zůstává historickým porovnáním.
- Kříž patky: 2 průběžné díly po 2 m na stožár, celkem `2M` kusů a `4M` metrů. Nahrazují 4 krátká ramena; vzpěry zůstávají 4 na stožár.
- Lana G: `2(N+1)` úseků délky `hypot(4.75,4)`; X: `4N` úseků délky `hypot(d,6)`; P: `2N` úseků délky `d`; T: `N+1` úseků délky `W`.
- Síť horní `L·W`, boční `2L·6`, bez čelních sítí. Rezerva se uplatní pouze na objednanou plochu sítí.
- Šířka mezi vnějšími kotvami `W+8` m, bez montážních a bezpečnostních odstupů.

Schéma, kusovník a CSV lan vznikají ze stejného grafu. Délky lan jsou osové, bez koncovek, průvěsu a montážních přídavků. Rozměrové limity vstupů jsou limity nástroje, nikoli dovolené konstrukční rozměry. Změna šířky vyžaduje samostatné ověření rozpětí, předpětí a nosné soustavy; modul rovněž není potvrzené únosné rozpětí. Neplatné zadání odstraní předchozí výstup a zablokuje export, místo aby použilo skryté výchozí hodnoty.

Materiálové pravidlo `PRONET-ROAD-MAST-003 v2` navazuje na kontrolu všech 9 listů PDF dne 08. 10. 2026 a upřesnění uživatele ze dne 09. 10. 2026. Počty vlastních dílů se sčítají z jednotlivých sestav stožárů. Změna zadání `USER-BASE-Y-20261008` přidává 4 Y kolíky patky a zachovává samostatný kolík lana; uživatel výslovně potvrdil součet 5. Změna `USER-BASE-CROSS-20261009` určuje dva průběžné díly kříže místo čtyř ramen, při zachování půdorysu délky 2 m. Polohy a konstrukční přípoje čtyř kolíků nejsou v PDF zadány, proto nemají v grafu vymyšlené souřadnice. Středový zemní trn zůstává samostatným dílem neznámého profilu, nikoli automaticky kolíkem Y.

Kusovník i CSV export používají stejné položky s uvedením listů/oddílů PDF a uživatelské změny. Vykazují pouze hotové Y kolíky, nikoli pásovinu pro jejich výrobu. Barevně rozlišené souhrny nejsou další materiál navíc. Hmotnosti se nejprve počítají z nezkrácené geometrie a zaokrouhluje se až součet. Pro 6 stožárů opraveného pravidla: 12 průběžných dílů kříže po 2 m, 24 Y patky + 6 Y lana = 30 Y kompletů, 209,124 kg hotových kolíků bez svarů. PDF reference zachovává 24 krátkých ramen a pouze 6 Y kolíků, 41,825 kg hotových kolíků po zaokrouhlení. Známá dílčí hmotnost nikdy nenahrazuje neurčenou úplnou hmotnost.

Další pravidla a neuzavřené položky jsou popsané v [docs/road-mast-rule.md](docs/road-mast-rule.md).

Výstupy jsou návrhovým podkladem, nikoli autorizovaným posudkem nebo certifikací ochranné funkce. Modulární stožár zejména nemá stanovenou dovolenou rychlost větru ani prokázanou odolnost celé sestavy při dynamickém zásahu UAV.

Testy:

```sh
node --test tests/*.test.mjs
```

Lokální náhled obslouží obsah složky `dist/` libovolným statickým serverem.

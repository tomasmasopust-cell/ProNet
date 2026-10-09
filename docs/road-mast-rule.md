# Silnice obecná: audit pravidla stožáru a materiálu

Pravidlo: `PRONET-ROAD-MAST-003 v2`, aktualizováno 09. 10. 2026. Zdroj: uživatelem dodaný `NEtron_technicky_navrh_rev03.pdf`, NT-S-03, revize 03, datum 08. 09. 2026, 9 listů. PDF je koncepční pracovní podklad, nikoli výrobní dokumentace nebo průkaz únosnosti. Dne 08. 10. 2026 byly přezkoumány texty, tabulky i výkresy všech listů.

Identita souboru: SHA-256 `a879bd82e3b3dd25dfd87c8d4886e2e77a7495ed2b74ca2165d1a1195497233a`. Autor v metadatech: NEtron – koncepční podklad dle zadání; původní titul: NEtron – dvě pole 15 × 6 m; návrh, zatížení a neduplicitní soupis materiálu – revize 03. Oficiální veřejná URL/DOI není v tomto podkladu uvedena. Vstupy odvozeného pravidla: délka, šířka a modul v m, rezerva sítě v %. Výstupy: díly v ks/sadách, délky v m, sítě v m² a určené dílčí hmotnosti v kg.

## Zdroj versus oprava zadání

PDF na listu 7/O vykazuje 1 Y komplet na stožár, spojený s kotevním lanem (listy 1/A, 2/D). Čtyři kruhové značky na půdorysu patky 1/B jsou popsány jako dolní přípoje vzpěr; PDF je nevykazuje jako čtyři Y kolíky. Proto nelze tvrdit, že oprava počtu plyne z původního soupisu PDF.

Uživatel dne 08. 10. 2026 upřesnil 4 Y kolíky na každou patku a výslovně potvrdil **4 u patky + 1 samostatný pro lano = 5 na stožár**. Změna `USER-BASE-Y-20261008` je požadavek zadavatele, nikoli nový statický závěr. Původní PDF zůstává nezměněné a referenční režim zachovává jeho historické počty. Parametrický režim používá opravené zadání.

Dne 09. 10. 2026 uživatel stanovil, že každý kříž patky je ze **2 průběžných dílů**, ne ze 4 samostatných ramen (`USER-BASE-CROSS-20261009`, requirement). Zachovaný půdorys má dosah 1 m od osy v každém směru, takže jeden průběžný díl má 2 m. Parametrický model obsahuje 2 fyzické díly na patku, celkem `2M` kusů a `4M` metrů. Historická reference zachovává 4 × 1 m. Čtyři vzpěry ani čtyři kolíky patky se touto změnou neruší. Zadání současně vylučuje pásovinu jako samostatnou položku kusovníku a exportu: vykazují se jen hotové Y komplety.

Počet kolíků je jednoznačný, ale jejich přesné polohy, zapuštění, sklon, přípoj k patce a únosnost zatím zadány nejsou. V grafu proto zůstávají záznamy vlastních dílů bez vymyšlených souřadnic. Středový zemní trn 1 m je samostatný díl: PDF výslovně nepotvrzuje profil Y. Čtyři Y kolíky ho bez dalšího rozhodnutí nenahrazují.

## Vlastní materiál jednoho stožáru

| Díl | Počet | Rozměr / omezení | Původ |
|---|---:|---|---|
| Stožárová trubka | 1 | 6 m, pracovní Ø 48,3 × 3,2 mm, ocel 7850 kg/m³ pouze pro hmotnost | PDF 1/A, 7/O, 9/S: example |
| Průběžný díl křížové patky | 2 | 2 m, neurčený profil a spojení | zadání 09. 10. 2026: requirement; délka ze zachovaného půdorysu |
| Spodní vzpěra | 4 | sqrt(0,8²+1²) = 1,2806248 m mezi osami, nikoli přířez | PDF 1/C, 7/O: example |
| Horní nasazovací trn | 1 | 0,6 m, neurčený profil a zajištění | PDF 1/C, 7/O: example |
| Středový zemní trn | 1 | 1 m, profil Y nepotvrzen | PDF 1/A, 7/O: example |
| Y komplet patky | 4 | hotový kolík, polohy a spoje neurčeny | potvrzené zadání: requirement |
| Y komplet kotevního lana | 1 | stejná geometrie, samostatná zemní kotva | PDF 2/D, 3/E-F, 7/O: example |
| Přípoj kotevního lana | 1 sada | v +4,75 m, výrobkové provedení neurčeno | PDF 1/A, 7/O: example |
| Horní přípoj lan | 1 sada | krajní: 3 konce, vnitřní: 5 konců | PDF 7/O, 9/R: example |
| Přípoj X-lan na patce | 1 sada | krajní: 1 konec, vnitřní: 2 konce | PDF 7/O, 9/R: example |
| Spojovací a zajišťovací sada | 1 | 8 přípojů vzpěr již uvnitř sady, spoj ramen a trnů, zajištění trubky, povrchová ochrana; počty šroubů/svary neurčeny | PDF 7/O: example |

Provedení 2 × 2 m nahrazuje 4 × 1 m; tato provedení se nikdy nesčítají. Pásovina není položkou kusovníku ani CSV, hotový Y kolík se započte pouze jednou. Geometrie jeho výroby níže slouží pouze k určení dílčí hmotnosti hotového kolíku. Komplety přípojů nesmějí být zaměněny za počet konců lan nebo za jednotlivé svorky/šekly. Sada patky nezahrnuje napínáky, koncovky lan ani připevnění sítě.

## Řada a sdílený materiál

Pro `L` délku, `W` šířku, `s` největší délku pole: `N=ceil(L/s)`, `d=L/N`, `M=2(N+1)`. Jde o geometrické odvození `PRONET-ROAD-MAST-002`, nikoli o potvrzení únosného rozpětí. Stožáry jsou dvě krajní řady, výška 6 m. Krajních stožárů je 4, vnitřních `M-4`.

Lana podle listu 8/P: `G=M`, `X=4N`, `P=2N`, `T=N+1`. Délky: G `sqrt(4,75²+4²)`, X `sqrt(d²+6²)`, P `d`, T `W`. Každá sdílená hrana a celé X-lano je pouze jednou. Horní podélné lano zároveň tvoří horní hranu boční sítě. Žádné střešní X-lano není zdrojem zadáno.

List 8/Q: vlastní G patří celé svému stožáru; ostatní lana se rozpočtově rozdělí polovinou na koncové stožáry. Součet podílů se rovná součtu celých úseků. Podíly nejsou stříhaná poloviční lana ani ověřená reakce patky.

List 9/R: 1 napínací komplet a 2 koncové komplety na každý úsek je rozpočtový předpoklad, ne závazné výrobkové řešení. Konce jsou rozděleny do přípojů skutečného grafu. Síť: horní `LW` (`N` panelů), boční `2L·6` (`2N` panelů). Součet materiálových ploch není jedna větrná plocha. Čelní sítě, dolní podélná lana a samostatná svislá okrajová lana nejsou zahrnuty. Připevnění sítí nemá určený počet; nesmí se interpretovat jako nula.

## Hmotnosti a otevřené kontroly

Y podle 3/E-F a 7/O: 3 × 1 × 0,04 × 0,008 × 7850 = 7,536 kg před seříznutím. Symetrická špička v posledních 0,15 m odebere polovinu objemu této části; hotový Y = 6,9708 kg, odřezky = 0,5652 kg. Jde o geometrický předpoklad bez svarů a přípojů. Výpočty nepoužívají předem zaokrouhlenou hmotnost každého dílu.

Úplná hmotnost zůstává neurčená: profily ramen, vzpěr a trnů, lana, sítě, přípoje, zajištění, povlak a připevnění sítí nejsou zadány. Listy 4/H, 5/J a 6/K-N požadují posouzení obou směrů větru, sání, prostorového působení a ochabování lan, předpětí, průvěsu, vytažení/posunu/převrácení patek, zeminy, sněhu a námrazy. Příklady sil nejsou zatížení konkrétního místa. Dovolená rychlost větru ani odolnost proti UAV nejsou potvrzeny.

## Ověření implementace

Testy porovnávají PDF referenci, opravený součet Y, nepřítomnost pásoviny v položkách kusovníku, přesné hmotnosti hotových kolíků, dva průběžné díly na patku v grafu i kusovníku, vlastní díly každé sestavy, konce lan a sdílené podíly, různé délky/šířky/moduly, poškozený kusovník, neplatné vstupy a znění UI/CSV. Materiálové položky pro tabulku i CSV vytváří jedna funkce `roadMastBomRows`. Kategorie `summary` je výslovně nesčítatelná s fyzickými komplety.

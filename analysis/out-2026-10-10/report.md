# WebCrawlerAPI low-recall diagnosis

Run webcrawlerapi-2026-10-10T09-17-17-201Z. 86 URLs where WCR <90% or error while >=4/5 competitors >=90%. Live re-fetch 2026-10-10. Rule-based categories for fetch/flaky/language/empty cases; Haiku review of missing text for the 48 content-loss cases.

## Summary

| Category | URLs | Share |
|---|---|---|
| flaky_now_ok | 20 | 23% |
| hero_header_intro | 11 | 13% |
| related_comments_footer_content | 10 | 12% |
| language_mismatch | 9 | 10% |
| nav_menu_boilerplate | 8 | 9% |
| tables_lists_data | 7 | 8% |
| different_page_content | 4 | 5% |
| near_empty | 3 | 3% |
| other | 3 | 3% |
| truncated_long_page | 3 | 3% |
| upstream_gone | 3 | 3% |
| blocked | 2 | 2% |
| tabs_accordion_hidden | 2 | 2% |
| timeout | 1 | 1% |

## Per URL

| ID | Category | Bench recall | Recall now | URL | Evidence |
|---|---|---|---|---|---|
| 8 | blocked | error | err | https://www.quora.com/What-is-the-placement-record-of-Manipal-University-for-stu | Blocked / 403 for WebCrawlerAPI |
| 566 | blocked | error | err | https://www.indeed.com/cmp/Brigit/salaries | Blocked / 403 for WebCrawlerAPI |
| 233 | different_page_content | 0.2713 | 0.2791 | https://www.mp.pl/lekarz/maria.pacyna-szmolke | md is disease-listing page; truth is doctor profile |
| 176 | different_page_content | 0.8321 | 0.855 | https://www.elder.org/our-locations/south-east/hampshire/emsworth | md is different live-in care page variant than truth (Home care in Emsworth) |
| 157 | different_page_content | 0.8827 | 0.8827 | https://explodingtopics.com/blog/ai-statistics | md is newer revision of statistics article |
| 801 | different_page_content | 0.8873 | 0.8775 | https://www.daifuku.com/company/summary/ | md shows FY2025 revision (different exec name/figures) |
| 793 | flaky_now_ok | 0.1739 | 1 | https://a-rent.com/public/uploads/images/MR193-ManualWM.pdf | Recall 1 on re-fetch (benchmark 0.1739) |
| 111 | flaky_now_ok | 0.3778 | 1 | https://v17.angular.io/docs/guide/guide/api/common/provideImageKitLoader | Recall 1 on re-fetch (benchmark 0.3778) |
| 924 | flaky_now_ok | 0.4278 | 0.9412 | https://www.brightedge.com/products | Recall 0.9412 on re-fetch (benchmark 0.4278) |
| 85 | flaky_now_ok | 0.492 | 0.9198 | https://www.growth-memo.com/p/live-session-recap-111324 | Recall 0.9198 on re-fetch (benchmark 0.492) |
| 3 | flaky_now_ok | 0.5714 | 0.9524 | https://developingeconomics.org/2024/06/24/post-conflict-recovery-and-trade-expl | Recall 0.9524 on re-fetch (benchmark 0.5714) |
| 412 | flaky_now_ok | 0.67 | 1 | https://steamcommunity.com/app/1172710/discussions/0/595146853490648464/ | Recall 1 on re-fetch (benchmark 0.67) |
| 635 | flaky_now_ok | 0.7214 | 0.9335 | http://katyaniexport.com | Recall 0.9335 on re-fetch (benchmark 0.7214) |
| 784 | flaky_now_ok | 0.7331 | 0.9395 | https://www.aeaweb.org/articles?id=10.1257%2Faer.20220973 | Recall 0.9395 on re-fetch (benchmark 0.7331) |
| 132 | flaky_now_ok | 0.7368 | 1 | https://nishiki-f.com/index.php/contact | Recall 1 on re-fetch (benchmark 0.7368) |
| 729 | flaky_now_ok | 0.8039 | 0.917 | https://www.ahrtal.de/ahrwein | Recall 0.917 on re-fetch (benchmark 0.8039) |
| 450 | flaky_now_ok | 0.8108 | 1 | http://hq.news.cn/20231028/977619280d86488f97759eb63f82be5d/c.html | Recall 1 on re-fetch (benchmark 0.8108) |
| 325 | flaky_now_ok | 0.8397 | 0.9924 | https://www.plasticsurgery.org/cosmetic-procedures/fat-transfer-breast-augmentat | Recall 0.9924 on re-fetch (benchmark 0.8397) |
| 991 | flaky_now_ok | 0.8448 | 0.9397 | https://help.fanruan.com/finereport10.0/doc-view-281.html | Recall 0.9397 on re-fetch (benchmark 0.8448) |
| 878 | flaky_now_ok | 0.8529 | 0.9 | https://docs.thena.ai/api-reference/search/comments-search | Recall 0.9 on re-fetch (benchmark 0.8529) |
| 96 | flaky_now_ok | 0.8723 | 0.9574 | https://rocogrouphomes.com/faqs | Recall 0.9574 on re-fetch (benchmark 0.8723) |
| 225 | flaky_now_ok | 0.8764 | 1 | http://hakon.com.au/pages/koni-2822-race-damper | Recall 1 on re-fetch (benchmark 0.8764) |
| 701 | flaky_now_ok | 0.8768 | 0.9493 | http://aaronkirman.com/listings/11870-ellice-st-malibu-ca-90265 | Recall 0.9493 on re-fetch (benchmark 0.8768) |
| 579 | flaky_now_ok | 0.8794 | 0.9127 | https://www.lescouvreursdurotoit.com/en/emergency-flat-roof-repair | Recall 0.9127 on re-fetch (benchmark 0.8794) |
| 12 | flaky_now_ok | 0.8831 | 0.9481 | https://www.forbes.com/councils/forbestechcouncil/2025/04/28/the-missing-piece-i | Recall 0.9481 on re-fetch (benchmark 0.8831) |
| 201 | flaky_now_ok | 0.8991 | 0.9254 | https://www.amazon.co.uk/MSI-MPG-Trident-11TC-2283UK-Gaming/dp/B09NRVVZ63 | Recall 0.9254 on re-fetch (benchmark 0.8991) |
| 607 | hero_header_intro | 0.6982 | 0.7043 | https://www.moja-rekonstrukcia.sk/rekonstrukcia-obyvacky | service-area intro and quote CTA |
| 632 | hero_header_intro | 0.7158 | 0.7105 | https://www.theshantyrestaurant.com/ | order/reserve buttons header |
| 748 | hero_header_intro | 0.7787 | 0.7905 | https://blissy.com/products/blissy-skinny-scrunchies-burgundy | product header: reviews, breadcrumb, price, Add to Cart |
| 230 | hero_header_intro | 0.8065 | 0.8065 | https://sspai.com/post/98249 | article title, byline, date, disclaimer |
| 147 | hero_header_intro | 0.8212 | 0.7989 | https://pmc.ncbi.nlm.nih.gov/articles/PMC10124679/ | title and intro paragraph; md starts mid-body |
| 362 | hero_header_intro | 0.8286 | 0.8 | https://www.digitalinfuzion.com/ | hero intro "At Digital Infuzion, we love taking on tough challenges" |
| 323 | hero_header_intro | 0.8352 | 0.7967 | https://www.cbr.com/why-harry-potter-did-not-die-deathly-hallows/ | headline and updated-date byline |
| 964 | hero_header_intro | 0.8693 | 0.8693 | https://landotsanitairesocial.wpcomstaging.com/2020/08/19/10-fiches-actions-pour | section label, date, author, share links |
| 347 | hero_header_intro | 0.8806 | 0.8806 | https://stylnn.com/es/products/le-jace-sectional-113-x-84-certipur-us-premium-fo | purchase widget: price, Add to cart, payment options |
| 66 | hero_header_intro | 0.8945 | 0.8945 | https://www.nbcnews.com/select/shopping/new-notable-january-2025-rcna187391 | headline, updated date, byline |
| 951 | hero_header_intro | 0.8995 | 0.8894 | https://www.navit.com/en/car-subscription | Missing "Car abo - Car subscriptions" title, "Your company e-mail" form, and card headings "Easy to use", "Fully digital", "Save up to 40 %" |
| 657 | language_mismatch | 0.2059 | 0.5294 | https://www.elliottmfg.com/contact/ | English-stopword ratio truth 0.18 vs md 0.05 |
| 242 | language_mismatch | 0.2469 | 0.1235 | https://docs.stripe.com/issuing/funding/balance | English-stopword ratio truth 0.31 vs md 0.02 |
| 458 | language_mismatch | 0.3618 | 0.3618 | https://desotoms.mugshots.zone/vaughn-cortray-cortez-mugshot-02-10-2025/ | English-stopword ratio truth 0.28 vs md 0.11 |
| 985 | language_mismatch | 0.4246 | 0.4325 | http://doranaves.com | English-stopword ratio truth 0.30 vs md 0.15 |
| 318 | language_mismatch | 0.5172 | 0.4655 | https://hightees.com.au/products/freedan-ginger-pic | English-stopword ratio truth 0.09 vs md 0.24 |
| 272 | language_mismatch | 0.5758 | 0.7727 | https://html.rhhz.net/YXXB/html/20210606.htm | English-stopword ratio truth 0.05 vs md 0.08 |
| 382 | language_mismatch | 0.5917 | 0.5667 | https://pickstar.pro/au/our-stars/8944/jodi-ann-ward | English-stopword ratio truth 0.25 vs md 0.12 |
| 455 | language_mismatch | 0.746 | 0.6786 | https://www.youtube.com/watch?v=ToYyqJo2kWk&lc=Ugy2xbbwpCuDZTRXdy54AaABAg | English-stopword ratio truth 0.11 vs md 0.27 |
| 728 | language_mismatch | 0.8302 | 0.8302 | https://www.nextinsure.com/ListingDisplay/display/?passthru=1&src=665963&ccid=40 | English-stopword ratio truth 0.40 vs md 0.23 |
| 753 | nav_menu_boilerplate | 0.7236 | 0.7561 | https://www.repvue.com/companies/CoverMyMeds | top nav: Home, Companies, Overview, Salaries… |
| 656 | nav_menu_boilerplate | 0.7647 | 0.7647 | https://thewindsorco.com/our-properties/new-york/retail-space/hannaford-plaza-gl | breadcrumb "Browse:Home…", gallery labels PHOTOS/SITEPLAN |
| 638 | nav_menu_boilerplate | 0.7989 | 0.7337 | https://developer.android.com/studio/projects/version-control | Missing breadcrumb and footer boilerplate: "Android Developers Develop Android Studio IDE guides", "Was this helpful?", "Content and code sa |
| 84 | nav_menu_boilerplate | 0.8103 | 0.7241 | http://lwssfirstcolonial.com/?utm_source=gbp&utm_medium=organic&utm_campaign=yex | Visit Us address, phone, hours |
| 546 | nav_menu_boilerplate | 0.812 | 0.812 | https://www.lethbridge.ca/emergency-services-public-safety/police/ | Missing nav and contact boilerplate: "Emergency Services & Public Safety", "View Full Menu", "Toggle Section", "Contact Us", "City Hall 910  |
| 327 | nav_menu_boilerplate | 0.8199 | 0.7978 | https://www.producthunt.com/posts/statistics-for-strava | tab nav "Overview Launches Reviews…", Built With tags |
| 705 | nav_menu_boilerplate | 0.8788 | 0.8788 | https://cliniquepsychologiequebec.com/categories/anxiete | "Lire la suite" link labels, title suffix |
| 914 | nav_menu_boilerplate | 0.8972 | 0.8972 | https://manual.blackvue.com/docs/dr750x-2ch-lte-plus/optional-accessories/parkin | breadcrumb, read time, Table of Contents |
| 217 | near_empty | 0.0459 | 0.0459 | https://www.researchhub.com/paper/766400/infant-transmittedfounder-hiv-1-viruses | Markdown only 80 chars |
| 17 | near_empty | 0.1071 | 0.1071 | https://www.bonanza.org/magazine/archive/2017/october-2017/surly-bonds/ | Markdown only 234 chars |
| 666 | near_empty | 0.4375 | 0.4375 | https://pastificioboulder.com/pages/contact | Markdown only 259 chars |
| 722 | other | 0.1862 | 0.1862 | https://dash.plotly.com/dash-ag-grid/column-definitions | body absent; only Plotly header/footer links (columnDefs content missing) |
| 277 | other | 0.4574 | 0.4574 | https://www.nationalgeographic.es/viaje-y-aventuras/albania | md mostly related-article/Taboola widgets; article body missing |
| 209 | other | 0.5 | 0.5 | https://hoo.be/savannahraedemers | link-in-bio buttons dropped |
| 692 | related_comments_footer_content | 0.5351 | 0.5351 | https://www.gilass.shop/products/kontrast-schwarz-kristall?pr_prod_strat=e5_desc | You may also like, reviews, payment badges |
| 712 | related_comments_footer_content | 0.5771 | 0.6766 | http://finadorm.com | Missing trailing company block: "Household and Institutional Furniture Manufacturing", "3,153 Followers", "CHAQUE GESTE CHEZ FINADORM", "Tél |
| 827 | related_comments_footer_content | 0.7865 | 0.7865 | https://askwealth.lpl.com/team/adham-kaibni | Missing author bio tail and contact block: "A native of the DC area", "University of Maryland", "Coral Gables, Florida", "(305) 704-7055", " |
| 648 | related_comments_footer_content | 0.7927 | 0.7927 | https://lei.mx/tag/veterinaria | Missing article metadata/tags footer: "Por Comunicación LEI", "Servicios veterinarios", "Test de Coggins", plus breadcrumb "Home Blog Tag -  |
| 605 | related_comments_footer_content | 0.8021 | 0.7861 | https://halfwheel.com/brick-house-ciento-por-ciento-slated-for-taa-2019/296566 | Missing author bio and trailing related posts: "I am an editor and co-founder of halfwheel.com", "Related Posts", "Brick House Ciento Por Ci |
| 797 | related_comments_footer_content | 0.815 | 0.8794 | https://www.eastdaley.com/the-burner-tip/pipeline-owners-await-a-cash-flow-gushe | Energy Data Studio access / newsletter subscribe text |
| 623 | related_comments_footer_content | 0.8395 | 0.8395 | https://osa.gg/news/blog-womens-try-a-tri-with-get-fit-guernsey | Missing trailing CTA block: "Don't leave your job search to chance", "Register today and we will tailor our search to your unique skills", " |
| 767 | related_comments_footer_content | 0.8571 | 0.8571 | https://m.gelonghui.com/p/1319051 | author block and bio |
| 669 | related_comments_footer_content | 0.8628 | 0.6836 | https://secura.net | Missing testimonials and company news tail: "Matt was fantastic through this whole process", "Company news", "SECURA Insurance publishes 202 |
| 523 | related_comments_footer_content | 0.8955 | 0.8507 | https://www.accessibilitychecker.org/guides/wcag/ | author/expert block, methodology, comments |
| 383 | tables_lists_data | 0.4681 | 0.4752 | https://docs.alpaca.markets/reference/cryptolatestquotes-1 | API Path/Query params and response codes |
| 756 | tables_lists_data | 0.6402 | 0.2992 | https://wiki.ai03.com/books/case-and-plate-design/page/brutally-honest-truths-of | revision history table rows |
| 586 | tables_lists_data | 0.7692 | 0.7835 | https://www.titustekform.com.au/product/stype-plus-125-0mm_2 | product listing prices and category menu |
| 165 | tables_lists_data | 0.8843 | 0.8843 | https://www.digikey.com/en/products/detail/edac-inc/833-026-559-108/11191619 | spec table: mounting type, contact material, positions |
| 778 | tables_lists_data | 0.8906 | 0.821 | https://www.aaii.com/etf/ticker/URTH#stats | stats block: Last Trade, 52-Wk range, returns, expense ratio |
| 366 | tables_lists_data | 0.8925 | 0.8925 | https://www.kazoohall.com/pc/monthly/?requestDate=202506#20250631 | event calendar rendered as table rows breaking word matches |
| 725 | tables_lists_data | 0.8997 | 0.8437 | https://vipclimat.by/katalog/konditcionery/kinghome/cosmo.html | Missing price/spec listing: "Кондиционер KingHome KWH09AWAXB-K6DNA3B", "Мощность: 2.5", "1 800 руб.СУПЕРЦЕНА!", "Настенный Cosmo Inverter R3 |
| 405 | tabs_accordion_hidden | 0.4844 | 0.4844 | https://developer.paypal.com/braintree/help/RefundTransaction | Select your issue / Refunds accordion content |
| 893 | tabs_accordion_hidden | 0.773 | 0.6738 | https://paronym.jp/media/commerce/live-commerce-success/ | collapsed INDEX table of contents |
| 959 | timeout | error | err | https://onlinelibrary.wiley.com/doi/10.1002/biot.202400596 | Timeout / anti-bot |
| 259 | truncated_long_page | 0.6753 | 0.6753 | http://mvw-tech.com/insights | md ends after M365 Tenant Assessment; later sections missing |
| 662 | truncated_long_page | 0.8292 | 0.8292 | https://www.insuremytrip.com/news/2024-most-popular-international-destinations-b | md stops at "About" heading; missing "About InsureMyTrip" paragraph, "SOURCE InsureMyTrip", "Related Articles", "Travel Insurance for Japan" |
| 889 | truncated_long_page | 0.8379 | 0.7339 | https://basc.org.uk/our-work/ | md ends after policy link; missing trailing teaser sections "Our partners", "Training courses", "Research", "Uplands", "Gamekeepers Welfare  |
| 55 | upstream_gone | error | err | https://es.ogs.ny.gov/veterans | Upstream returns 404/410 error to WebCrawlerAPI, others got content |
| 43 | upstream_gone | error | err | http://www.harada-s-s.com/facilitiesequipment.html | Upstream returns 404/410 error to WebCrawlerAPI, others got content |
| 799 | upstream_gone | error | err | https://doda.jp/DodaFront/View/JobSearchDetail/j_jid__3011964720/ | Upstream returns 404/410 error to WebCrawlerAPI, others got content |

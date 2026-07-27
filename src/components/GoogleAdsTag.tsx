/** Google Ads conversion tag (gtag.js) — jeden tag na całą witrynę. */
const GOOGLE_ADS_ID = "AW-18288481323";

export function GoogleAdsTag() {
  return (
    <>
      <script async src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`} />
      <script
        dangerouslySetInnerHTML={{
          __html: `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GOOGLE_ADS_ID}');
          `.trim(),
        }}
      />
    </>
  );
}

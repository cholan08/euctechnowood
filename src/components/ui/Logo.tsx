/** EUC Technowood's logo (from euctechnowood.com), with the product name beside it. */
export function Logo() {
  return (
    <span className="brand">
      <img src="/brand/logo.png" alt="EUC Technowood" width={150} height={45} />
      <span className="brand-tag">Room Studio</span>
    </span>
  );
}

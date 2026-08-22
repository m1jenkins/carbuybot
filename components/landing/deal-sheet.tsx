import type { CSSProperties } from "react";

export function DealSheet() {
  return (
    <section className="sec rule-top" id="deal-sheet">
      <div className="wrap">
        <div className="head rv">
          <span className="label">Your deal sheet</span>
          <h2 className="d2">One sheet, not forty emails.</h2>
          <p className="lede">
            Replies come in over a week or two, each one worded to sound like the best offer.
            Your agent files every one into the same sheet as it lands &mdash; vehicle price, each fee, tax
            and title, your trade &mdash; and keeps the math current. This is the document you decide from,
            and it stays yours afterwards.
          </p>
        </div>

        <figure className="sheet rv">
          <div className="sheet__box">
            <div className="sheet__bar">
              <span className="sheet__file">
                <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
                  <g stroke="currentColor" strokeWidth="1.3" fill="none">
                    <rect x="1.4" y="1.4" width="13.2" height="13.2" />
                    <path d="M1.4 6h13.2M1.4 10.5h13.2M6.5 1.4v13.2" />
                  </g>
                </svg>
                gv80-3.5t-prestige.xlsx
              </span>
              <span className="sheet__live"><i aria-hidden="true"></i>Updated as each reply lands</span>
            </div>

            <div className="sheet__fx">
              <span className="sheet__ref num" aria-hidden="true">G8</span>
              <code>=MIN(G2:G7)</code>
            </div>

            <div className="sheet__scroll">
              <table className="grid">
                <caption className="sr-only">Out-the-door quotes compiled from every dealer that replied</caption>
                <colgroup>
                  <col style={{ width: "34px" }} />
                  <col style={{ width: "110px" }} />
                  <col style={{ width: "58px" }} />
                  <col style={{ width: "112px" }} />
                  <col style={{ width: "114px" }} />
                  <col style={{ width: "104px" }} />
                  <col style={{ width: "102px" }} />
                  <col style={{ width: "120px" }} />
                  <col style={{ width: "200px" }} />
                </colgroup>
                <thead>
                  <tr className="cols" aria-hidden="true">
                    <td className="rownum"></td>
                    <td className="c-dealer">A</td>
                    <td>B</td>
                    <td>C</td>
                    <td>D</td>
                    <td>E</td>
                    <td>F</td>
                    <td>G</td>
                    <td>H</td>
                  </tr>
                  <tr className="names">
                    <td className="rownum" aria-hidden="true">1</td>
                    <th scope="col" className="c-dealer">Dealer</th>
                    <th scope="col">Mi</th>
                    <th scope="col">Vehicle</th>
                    <th scope="col">Fees &amp; add-ons</th>
                    <th scope="col">Tax, title</th>
                    <th scope="col">Trade</th>
                    <th scope="col">Out the door</th>
                    <th scope="col">What your agent got</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="is-win" style={{ "--i": 1 } as CSSProperties}>
                    <td className="rownum" aria-hidden="true">2</td>
                    <th scope="row" className="c-dealer">Dealer A</th>
                    <td>14</td>
                    <td>$57,900</td>
                    <td>$1,190</td>
                    <td>$4,150</td>
                    <td>&minus;$2,000</td>
                    <td className="c-otd">$61,240</td>
                    <td className="c-note">Nitrogen fill and pinstriping struck off</td>
                  </tr>
                  <tr style={{ "--i": 2 } as CSSProperties}>
                    <td className="rownum" aria-hidden="true">3</td>
                    <th scope="row" className="c-dealer">Dealer B</th>
                    <td>31</td>
                    <td>$58,400</td>
                    <td>$2,150</td>
                    <td>$4,150</td>
                    <td>&minus;$2,000</td>
                    <td className="c-otd">$62,700</td>
                    <td className="c-note">Held on a $895 protection package</td>
                  </tr>
                  <tr style={{ "--i": 3 } as CSSProperties}>
                    <td className="rownum" aria-hidden="true">4</td>
                    <th scope="row" className="c-dealer">Dealer C</th>
                    <td>52</td>
                    <td>$57,650</td>
                    <td>$1,480</td>
                    <td>$4,150</td>
                    <td>&minus;$1,300</td>
                    <td className="c-otd">$61,980</td>
                    <td className="c-note">Lowest sticker, but valued the trade $700 under</td>
                  </tr>
                  <tr style={{ "--i": 4 } as CSSProperties}>
                    <td className="rownum" aria-hidden="true">5</td>
                    <th scope="row" className="c-dealer">Dealer D</th>
                    <td>68</td>
                    <td>$58,900</td>
                    <td>$1,240</td>
                    <td>$4,150</td>
                    <td>&minus;$2,000</td>
                    <td className="c-otd">$62,290</td>
                    <td className="c-note">Would not cover the freight charge</td>
                  </tr>
                  <tr style={{ "--i": 5 } as CSSProperties}>
                    <td className="rownum" aria-hidden="true">6</td>
                    <th scope="row" className="c-dealer">Dealer E</th>
                    <td>12</td>
                    <td>$59,450</td>
                    <td>$1,690</td>
                    <td>$4,150</td>
                    <td>&minus;$1,850</td>
                    <td className="c-otd">$63,440</td>
                    <td className="c-note">Stayed at sticker on this trim</td>
                  </tr>
                  <tr style={{ "--i": 6 } as CSSProperties}>
                    <td className="rownum" aria-hidden="true">7</td>
                    <th scope="row" className="c-dealer">Dealer F</th>
                    <td>44</td>
                    <td className="na">&mdash;</td>
                    <td className="na">&mdash;</td>
                    <td className="na">&mdash;</td>
                    <td className="na">&mdash;</td>
                    <td className="c-otd na">&mdash;</td>
                    <td className="c-note">Sold the car before it quoted a price</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr style={{ "--i": 7 } as CSSProperties}>
                    <td className="rownum" aria-hidden="true">8</td>
                    <th scope="row" className="c-dealer">Lowest</th>
                    <td colSpan={5}>Nine dealers contacted, six replied, five priced the car</td>
                    <td className="c-otd cell--live">$61,240</td>
                    <td className="c-note">$2,200 between the best and worst quote</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <ul className="sheet__tabs">
              <li className="is-on">Offers</li>
              <li>Fees &amp; add-ons</li>
              <li>Trade-in</li>
              <li>Financing</li>
              <li>Email log</li>
            </ul>
          </div>
          <figcaption>
            Illustrative sheet. The columns and the arithmetic are the real ones &mdash; every
            quote is priced out the door, so a low sticker with a thin trade offer cannot hide in it. The
            dealers and figures show the shape of a deal rather than one customer&rsquo;s.
          </figcaption>
        </figure>

        <ul className="trio rv" style={{ "--d": "90ms" } as CSSProperties}>
          <li>
            <b>Yours to keep</b>
            <span>
              It goes out as a spreadsheet and a PDF, so you still have the whole file long after the
              deal closes.
            </span>
          </li>
          <li>
            <b>Made to be shown to someone</b>
            <span>
              Plain enough to hand to your spouse, your credit union, or the dealer you are about to
              sign with.
            </span>
          </li>
          <li>
            <b>Every figure traces back</b>
            <span>
              Each number is filed against the email it came from, quoted and timestamped, so you can
              check any line yourself.
            </span>
          </li>
        </ul>
      </div>
    </section>
  );
}

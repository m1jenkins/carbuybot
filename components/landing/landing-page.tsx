import type { CSSProperties } from "react";

import { CheckoutForm } from "../checkout/checkout-form";
import { LandingMotion } from "./landing-motion";

export function LandingPage() {
  return (
    <>
      <LandingMotion />
      <a className="skip" href="#main">Skip to content</a>

      <header className="hdr" id="hdr">
        <div className="wrap">
          <a className="mark" href="#" aria-label="CarBuyerBots home">
            <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
              <g stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round">
                <circle cx="12" cy="12" r="9.1"/><circle cx="12" cy="12" r="3.1"/>
                <path d="M12 15.1V21M9.3 10.6L4 8.1M14.7 10.6L20 8.1"/>
              </g>
            </svg>
            CarBuyerBots
          </a>
          <nav aria-label="Primary">
            <a href="#how">How it works</a>
            <a href="#negotiation">Real negotiation</a>
            <a href="#compare">Compare</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
          </nav>
          <a className="btn btn--ink" href="#start">Start my search</a>
        </div>
      </header>

      <main id="main">

        {/* Hero: cinematic plate + the live email thread as the product artifact */}
        <section className="hero plate" id="top">
          <div className="plate__media">
            <picture>
              <source media="(min-width:721px)" srcSet="/media/hero-wide.jpg" />
              <img src="/media/hero.jpg" alt="" fetchPriority="high" decoding="async" />
            </picture>
          </div>
          <div className="plate__scrim"></div>
          <div className="plate__body wrap">
            <div className="hero-copy">
              <span className="label">First 100 checkout reservations are $349 instead of $399</span>
              <h1 className="d1"><span>Let a bot haggle</span> <span>for your next car</span></h1>
              <p className="lede">
                Tell us the car you want. Your agent finds it at dealers near you, emails all of them, and negotiates
                the out-the-door price with every one of them at the same time.
              </p>
              <div className="hero-act">
                <a className="btn btn--light" href="#start">Start my search</a>
                <a className="tlink" href="#negotiation">Read a real negotiation
                  <svg width="15" height="9" viewBox="0 0 15 9" fill="none" aria-hidden="true"><path d="M0 4.5h13M9.4 1l3.6 3.5L9.4 8" stroke="currentColor" strokeWidth="1.3"/></svg>
                </a>
              </div>
            </div>

            <aside className="hero-demo" id="hero-demo" aria-hidden="true">
              <div className="hero-demo__head">
                <span className="label">Your agent, emailing a dealer</span>
                <p>Re: 2025 Genesis GV80 3.5T Prestige</p>
              </div>
              <div className="hero-demo__thread">
                <div className="msg msg--dealer" data-beat>
                  <div className="msg__clip"><div className="msg__pad">
                    <span className="who">Dealer</span>
                    <p>I received your offer of $60,183 plus tax and title. I&rsquo;ll review it with my management team and see how close we can get.</p>
                  </div></div>
                </div>
                <div className="msg msg--compose" data-compose>
                  <div className="msg__clip"><div className="msg__pad">
                    <span className="who">Your agent</span>
                    <span className="caret"></span>
                  </div></div>
                </div>
                <div className="msg msg--agent" data-beat>
                  <div className="msg__clip"><div className="msg__pad">
                    <span className="who">Your agent</span>
                    <p>We&rsquo;ll look at $62,700. No deposit for now &mdash; send pricing on those four items. Also, can you arrange shipping to Dallas?</p>
                  </div></div>
                </div>
                <div className="msg msg--dealer" data-beat>
                  <div className="msg__clip"><div className="msg__pad">
                    <span className="who">Dealer</span>
                    <p>If we can close at $62,700 today, my manager will throw in all four accessories at no charge. We&rsquo;ll cover transport to Dallas.</p>
                  </div></div>
                </div>
                <div className="msg msg--compose" data-compose>
                  <div className="msg__clip"><div className="msg__pad">
                    <span className="who">Your agent</span>
                    <span className="caret"></span>
                  </div></div>
                </div>
                <div className="msg msg--agent msg--close" data-beat>
                  <div className="msg__clip"><div className="msg__pad">
                    <span className="who">Your agent</span>
                    <p>Signed at <span className="num money">$62,700</span> out the door, with $1,380 of accessories included. Mike never walked into the store.</p>
                  </div></div>
                </div>
              </div>
            </aside>
          </div>
        </section>

        {/* Trust rail */}
        <div className="rail">
          <div className="wrap">
            <ul>
              <li><b>$349 intro / $399 standard</b><span>One car, paid once. The first 100 Checkout reservations get the intro price.</span></li>
              <li><b>Dealers never pay us a cent</b><span>You are the only party on either side who pays us.</span></li>
              <li><b>You approve every number</b><span>Nothing is agreed or signed without you.</span></li>
            </ul>
          </div>
        </div>

        {/* Statement */}
        <section className="sec">
          <div className="wrap stmt">
            <div className="stmt__l rv">
              <span className="label">Who we work for</span>
              <h2 className="d2">One side of the table.</h2>
            </div>
            <div className="stmt__r rv" style={{ "--d": "90ms" } as CSSProperties}>
              <p>
                Almost everyone else in a car deal is paid by the dealership. The lead site that sold your email.
                The finance office selling the warranty. Even the broker who takes a fee from you and a spiff
                from them.
              </p>
              <p>
                <strong>We are paid by you, once, and by nobody else.</strong> That one fact decides how the
                service behaves: what your agent asks for, when it walks away, and why it will tell you a deal
                is worse than the one you already have.
              </p>
              <p>
                Your agent gives its name, says it is buying on your behalf, and says it is an AI. It never
                pretends to be you. It negotiates over email, so you keep the paper trail. You review the
                numbers and you sign them. We never take title to a car and we never touch your money.
              </p>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="sec rule-top" id="how">
          <div className="wrap">
            <div className="head rv">
              <span className="label">How it works</span>
              <h2 className="d2">How your agent buys the car.</h2>
              <p className="lede">You spend about five minutes at the start and a few minutes at the end. Your agent
                does everything in between.</p>
            </div>

            <div style={{ "marginTop": "clamp(52px,7vw,92px)" }}>
              <article className="step rv">
                <figure className="step__fig plate">
                          <div className="plate__media"><img src="/media/spec.jpg" alt="Close detail of a leather seat back and its adjustment controls." loading="lazy" decoding="async" /></div>
                  <figcaption>Trim, color, options. The spec you would actually accept.</figcaption>
                </figure>
                <div className="step__txt">
                  <div className="step__n"><b className="num">01</b><span>Brief your agent &middot; 5 minutes</span></div>
                  <h3 className="d3">Tell it what you want</h3>
                  <p>Make, model, trim, your ceiling, what you are trading in, when you need it. The same things
                    you would tell a friend who knows cars.</p>
                </div>
              </article>

              <article className="step step--flip rv">
                <figure className="step__fig plate">
                          <div className="plate__media"><img src="/media/lot.jpg" alt="Aerial view of new cars parked in rows across a dealer lot." loading="lazy" decoding="async" /></div>
                  <figcaption>Every nearby lot, worked at the same time.</figcaption>
                </figure>
                <div className="step__txt">
                  <div className="step__n"><b className="num">02</b><span>It goes to work</span></div>
                  <h3 className="d3">Every dealer, at the same time</h3>
                  <p>Your agent finds the car at dealers near you, emails each one as your named buying agent,
                    and negotiates all the threads at once. It answers at 11pm on a Sunday if that is when a
                    dealer writes back.</p>
                </div>
              </article>

              <article className="step rv">
                <figure className="step__fig plate">
                          <div className="plate__media"><img src="/media/road.jpg" alt="An empty road curving through hills at dusk." loading="lazy" decoding="async" /></div>
                  <figcaption>No lot. No finance office.</figcaption>
                </figure>
                <div className="step__txt">
                  <div className="step__n"><b className="num">03</b><span>You decide</span></div>
                  <h3 className="d3">Pick the offer you like</h3>
                  <p>Every offer lands on one screen as an out-the-door price with tax, title and fees already
                    in it. Approve one and sign. You can skip the finance office entirely.</p>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* Real negotiation */}
        <section className="sec dark" id="negotiation">
          <div className="wrap">
            <div className="head rv">
              <span className="label">Real negotiation</span>
              <h2 className="d2">One real thread, start to signature.</h2>
              <p className="lede">A real email thread, lightly trimmed. 2025 Genesis GV80 3.5T Prestige.</p>
            </div>

            <div className="ev">
              <div className="thread">
                <div className="msg msg--dealer rv">
                  <span className="who">Dealer</span>
                  <p>I received your offer of $60,183 plus tax and title. I&rsquo;ll review it with my management
                    team and see how close we can get.</p>
                </div>
                <div className="msg msg--agent rv" style={{ "--d": "70ms" } as CSSProperties}>
                  <span className="who">Your agent</span>
                  <p>While management looks &mdash; does that Prestige include the tow hitch, illuminated door
                    scuff plates, fitted liners, and mudguards? If not, what would they cost to add?</p>
                </div>
                <div className="msg msg--dealer rv" style={{ "--d": "140ms" } as CSSProperties}>
                  <span className="who">Dealer</span>
                  <p>Best we can do is $62,700 plus tax and title. Those items would be aftermarket rather than
                    factory. If $62,700 works, we can move forward, including the deposit.</p>
                </div>
                <div className="msg msg--agent rv" style={{ "--d": "210ms" } as CSSProperties}>
                  <span className="who">Your agent</span>
                  <p>We&rsquo;ll look at $62,700. No deposit for now &mdash; send pricing on those four items.
                    Also, can you arrange shipping to Dallas?</p>
                </div>
                <div className="msg msg--dealer rv" style={{ "--d": "280ms" } as CSSProperties}>
                  <span className="who">Dealer</span>
                  <p>Pricing on those items runs about $1,380 installed. If we can close at $62,700 today, my
                    manager will throw in all four accessories at no charge.</p>
                </div>
                <div className="msg msg--agent rv" style={{ "--d": "350ms" } as CSSProperties}>
                  <span className="who">Your agent</span>
                  <p>Deal at $62,700 out-the-door with the tow hitch, scuff plates, liners, and mudguards
                    included &mdash; and delivery to Dallas on your truck. Send the buyer&rsquo;s order with
                    those terms in writing and we&rsquo;re done.</p>
                </div>
                <div className="msg msg--dealer rv" style={{ "--d": "420ms" } as CSSProperties}>
                  <span className="who">Dealer</span>
                  <p>You&rsquo;ve got it. All four items included at no cost, and we&rsquo;ll cover transport to
                    Dallas. Buyer&rsquo;s order coming over now.</p>
                </div>
                <div className="msg msg--agent msg--close rv" style={{ "--d": "490ms" } as CSSProperties}>
                  <span className="who">Your agent</span>
                  <p>Signed at $62,700 out the door, with $1,380 of accessories included and the dealer paying
                    to truck the car to Dallas. Mike put down no deposit and never walked into the store.</p>
                </div>
              </div>

              <aside className="ev__rail rv" style={{ "--d": "90ms" } as CSSProperties}>
                <b className="figure-xl">$1,380</b>
                <span className="figure-sub">of accessories the dealer threw in, plus the delivery he paid for.</span>
                <ul>
                  <li><b>It opened with a number, in writing.</b> The agent put $60,183 on the table first, and every counter after that got measured against it.</li>
                  <li><b>The extras came free.</b> A tow hitch, scuff plates, liners and mudguards would have run $1,380 installed. The dealer added them to close the sale.</li>
                  <li><b>The dealer paid for shipping.</b> The car went to Dallas on his truck, so Mike never had to see the lot.</li>
                  <li><b>No money moved until the paperwork matched.</b> The agent refused a deposit until all four terms were written on the buyer&rsquo;s order.</li>
                </ul>
              </aside>
            </div>

            <p className="foot">
              Real email thread, August 2026, lightly trimmed. Personal names, dealership identity, and location
              removed; prices and terms preserved. $1,380 is the installed price the dealer quoted for the four
              accessories he then included at no charge. One customer&rsquo;s result, not a guarantee.
            </p>
          </div>
        </section>

        {/* What you get */}
        <section className="sec">
          <div className="wrap">
            <div className="head rv">
              <span className="label">What you get</span>
              <h2 className="d2">Every offer on one screen.</h2>
              <p className="lede">Not monthly payments. Not &ldquo;starting at.&rdquo; The out-the-door price you would
                actually sign, from every dealer that answered, with tax and fees already in it.</p>
            </div>

            <div className="offers rv">
              <article className="offer offer--best">
                <div className="offer__top"><b>Dealer A</b><span className="cap num">14 mi</span></div>
                <div className="offer__otd">
                  <span className="k">Out the door</span>
                  <span className="v">$61,240</span>
                </div>
                <dl>
                  <div><dt>Vehicle price</dt><dd>$57,900</dd></div>
                  <div><dt>Fees &amp; add-ons</dt><dd>$1,190</dd></div>
                  <div><dt>Tax, title, reg.</dt><dd>$4,150</dd></div>
                  <div><dt>Trade credit</dt><dd>&minus;$2,000</dd></div>
                </dl>
                <span className="chip">Lowest out-the-door</span>
              </article>
              <article className="offer">
                <div className="offer__top"><b>Dealer B</b><span className="cap num">31 mi</span></div>
                <div className="offer__otd">
                  <span className="k">Out the door</span>
                  <span className="v">$62,700</span>
                </div>
                <dl>
                  <div><dt>Vehicle price</dt><dd>$58,400</dd></div>
                  <div><dt>Fees &amp; add-ons</dt><dd>$2,150</dd></div>
                  <div><dt>Tax, title, reg.</dt><dd>$4,150</dd></div>
                  <div><dt>Trade credit</dt><dd>&minus;$2,000</dd></div>
                </dl>
                <span className="chip chip--quiet">$895 protection package</span>
              </article>
              <article className="offer">
                <div className="offer__top"><b>Dealer C</b><span className="cap num">52 mi</span></div>
                <div className="offer__otd">
                  <span className="k">Out the door</span>
                  <span className="v">$61,980</span>
                </div>
                <dl>
                  <div><dt>Vehicle price</dt><dd>$57,650</dd></div>
                  <div><dt>Fees &amp; add-ons</dt><dd>$1,480</dd></div>
                  <div><dt>Tax, title, reg.</dt><dd>$4,150</dd></div>
                  <div><dt>Trade credit</dt><dd>&minus;$1,300</dd></div>
                </dl>
                <span className="chip chip--quiet">Trade valued $700 lower</span>
              </article>
            </div>
            <p className="cap" style={{ "marginTop": "20px" }}>Illustrative layout. The figures show the shape of the
              comparison, not a specific customer&rsquo;s deal.</p>
          </div>
        </section>

        {/* Three-way comparison */}
        <section className="sec rule-top" id="compare">
          <div className="wrap">
            <div className="head rv">
              <span className="label">Compare</span>
              <h2 className="d2">Cheaper than a broker. And you do none of the work.</h2>
              <p className="lede">Coaching tools hand you a script and leave you to use it. A broker does the talking,
                usually at one dealer, for four to seven times the price.</p>
            </div>

            <div className="cmp-scroll rv">
              <table className="cmp">
                <caption className="sr-only">Coaching tools compared with CarBuyerBots and a human broker</caption>
                <thead>
                  <tr>
                    <td></td>
                    <th scope="col">Coaching tools</th>
                    <th scope="col" className="us">CarBuyerBots</th>
                    <th scope="col">Human broker</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Who does the negotiating</th>
                    <td data-col="Coaching tools">You do, from a script</td>
                    <td className="us" data-col="CarBuyerBots">Your agent, end to end</td>
                    <td data-col="Human broker">The broker</td>
                  </tr>
                  <tr>
                    <th scope="row">Dealers worked at once</th>
                    <td data-col="Coaching tools">One at a time</td>
                    <td className="us" data-col="CarBuyerBots">Every nearby dealer, at the same time</td>
                    <td data-col="Human broker">Usually one relationship</td>
                  </tr>
                  <tr>
                    <th scope="row">Hours covered</th>
                    <td data-col="Coaching tools">Whenever you are free</td>
                    <td className="us" data-col="CarBuyerBots">Nights and weekends included</td>
                    <td data-col="Human broker">Business hours</td>
                  </tr>
                  <tr>
                    <th scope="row">Who pays</th>
                    <td data-col="Coaching tools">You</td>
                    <td className="us" data-col="CarBuyerBots">You only, never dealers</td>
                    <td data-col="Human broker">You, and sometimes the dealer too</td>
                  </tr>
                  <tr>
                    <th scope="row">Out-the-door comparison</th>
                    <td data-col="Coaching tools">You build the spreadsheet</td>
                    <td className="us" data-col="CarBuyerBots">One screen, tax and fees included</td>
                    <td data-col="Human broker">Verbal, one deal at a time</td>
                  </tr>
                  <tr>
                    <th scope="row">Typical cost</th>
                    <td className="cost" data-col="Coaching tools">$10 to $79</td>
                    <td className="us cost" data-col="CarBuyerBots">$349 intro / $399 standard</td>
                    <td className="cost" data-col="Human broker">$500 to $2,500, or 1% to 5%</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="cap" style={{ "marginTop": "20px" }}>Coaching and broker pricing reflects fees advertised publicly
              by U.S. car buying tools and services.</p>
          </div>
        </section>

        {/* Pricing */}
        <section className="sec rule-top" id="pricing">
          <div className="wrap">
            <div className="head rv" style={{ "marginBottom": "clamp(44px,6vw,72px)" }}>
              <span className="label">Pricing</span>
              <h2 className="d2">One flat fee, with a refund behind it.</h2>
            </div>

            <div className="price">
              <div className="price__l rv">
                <div className="price__amt"><b className="num">$349</b><span className="price__standard num">intro / $399 standard</span></div>
                <p className="price__note">You pay once, per car. $349 for the first 100 checkout reservations, then $399.
                  Checkout first, then complete your vehicle brief.</p>
                <div className="gtee">
                  <b>Save more than your service fee, or you <span className="money">don&rsquo;t pay it</span>.</b>
                  <p>If your agent can&rsquo;t negotiate savings bigger than its own fee, we refund you in full.
                    There is no subscription and no commission from the other side.</p>
                </div>
                <a className="btn btn--ink" href="#start">Start my search</a>
              </div>

              <ul className="incl rv" style={{ "--d": "90ms" } as CSSProperties}>
                <li>We find your car at every dealer near you</li>
                <li>Your agent runs the entire negotiation over email</li>
                <li>Every offer on one screen, tax and fees included</li>
                <li>Trade-in payoff and lender quotes collected alongside</li>
                <li>A read of the final contract for junk fees and add-ons</li>
              </ul>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="sec rule-top" id="faq">
          <div className="wrap">
            <div className="head rv">
              <span className="label">Questions</span>
              <h2 className="d2">Car buying questions, answered.</h2>
              <p className="lede">The things people ask before they let a bot negotiate on their behalf.</p>
            </div>

            <div className="faq rv">
              <details open>
                <summary>Do dealers know they&rsquo;re talking to an AI?</summary>
                <p className="answer">Yes. Your agent gives its name, says it is buying on your behalf, and says it is
                  an AI. It never pretends to be you. Most dealers keep negotiating anyway, because they still
                  want the sale.</p>
              </details>
              <details>
                <summary>Who actually buys the car?</summary>
                <p className="answer">You do. The agent negotiates and gathers the paperwork, but you review the final
                  numbers and you sign them. We never take title to a car and we never touch your money.</p>
              </details>
              <details>
                <summary>Is this like a car broker?</summary>
                <p className="answer">A broker charges $500 to $2,500 and usually works one dealer relationship at a
                  time. Our service is $349 for the first 100 Checkout reservations and $399 after that, and your
                  agent works every dealer at the same time. Brokers are also sometimes paid by the dealer. We are
                  paid only by you.</p>
              </details>
              <details>
                <summary>Do you handle new and used cars?</summary>
                <p className="answer">Both, as long as the car is listed by a licensed dealer. We don&rsquo;t handle
                  private party sales.</p>
              </details>
              <details>
                <summary>What about my trade-in and financing?</summary>
                <p className="answer">Your agent gathers payoff quotes and lender options while it negotiates the car,
                  so you can judge the deal on total out-the-door cost instead of a monthly payment.</p>
              </details>
              <details>
                <summary>Is my information private?</summary>
                <p className="answer">We use your details to run your negotiation and nothing else. We don&rsquo;t sell
                  them, and dealers see only what a purchase actually requires.</p>
              </details>
            </div>
          </div>
        </section>

        {/* Closing */}
        <section className="close plate" id="start">
          <div className="plate__media"><img src="/media/closing.jpg" alt="" loading="lazy" decoding="async" /></div>
          <div className="plate__scrim"></div>
          <div className="plate__body wrap">
            <span className="label">Start</span>
            <h2 className="d2">Put an agent on your next car.</h2>
            <p className="lede" style={{ "maxWidth": "46ch", "marginTop": "18px" }}>The first 100 checkout reservations are $349 instead of
              $399. Leave your email to reserve Checkout, then fill out your brief after payment.</p>
            <CheckoutForm />
            <p className="fnote">Checkout first, then complete your vehicle brief. If your agent doesn&rsquo;t save
              you more than the service fee, we refund that fee in full.</p>
          </div>
        </section>
      </main>

      <footer>
        <div className="wrap">
          <div className="fgrid">
            <a className="mark" href="#top">
              <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                <g stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round">
                  <circle cx="12" cy="12" r="9.1"/><circle cx="12" cy="12" r="3.1"/>
                  <path d="M12 15.1V21M9.3 10.6L4 8.1M14.7 10.6L20 8.1"/>
                </g>
              </svg>
              CarBuyerBots
            </a>
            <nav aria-label="Footer">
              <a href="#how">How it works</a>
              <a href="#negotiation">Real negotiation</a>
              <a href="#compare">Compare</a>
              <a href="#pricing">Pricing</a>
              <a href="#faq">FAQ</a>
            </nav>
          </div>
          <p className="disc">
            CarBuyerBots is a software service acting at the customer&rsquo;s direction as their authorized
            purchasing agent for vehicles sold by licensed dealers. CarBuyerBots is not a dealer, lender, or
            insurer, does not buy or sell vehicles, and receives no compensation from dealerships. Savings figures
            describe individual results and are not guaranteed. Broker and coaching-tool pricing cited on this page
            reflects fees advertised publicly by U.S. car buying services. Photography licensed under the Unsplash
            License; see media/CREDITS.md.
          </p>
          <p className="copy">&copy; <span id="year">2026</span> CarBuyerBots. All rights reserved.</p>
        </div>
      </footer>

      <div className="mcta" id="mcta">
        <span><b>$349 intro / $399 standard</b><span>full refund if savings don&rsquo;t exceed your fee</span></span>
        <a className="btn btn--light" href="#start">Start my search</a>
      </div>
    </>
  );
}

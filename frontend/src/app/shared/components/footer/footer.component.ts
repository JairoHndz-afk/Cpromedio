import { ChangeDetectionStrategy, Component } from "@angular/core";

import { BrandMarkComponent } from "../brand-mark/brand-mark.component";

@Component({
  selector: "app-footer",
  standalone: true,
  imports: [BrandMarkComponent],
  template: `
    <footer class="site-footer site-footer--quote">
      <div class="site-footer__inner site-footer__inner--quote">
        <app-brand-mark class="footer-quote__brand" variant="dark" aria-hidden="true"></app-brand-mark>
        <p class="footer-quote">Si ustedes, los j\u00f3venes, no asumen la direcci\u00f3n de su propio pa\u00eds, nadie va a venir a salvarlo. \u00a1Nadie!</p>
        <p class="footer-quote__source">Jaime Garz\u00f3n</p>
      </div>
    </footer>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FooterComponent {}

import { ChangeDetectionStrategy, Component, Input } from "@angular/core";

@Component({
  selector: "app-brand-mark",
  standalone: true,
  template: `
    <span
      class="brand__icon-shell"
      [class.brand__icon-shell--light]="variant === 'light'"
      [class.brand__icon-shell--dark]="variant === 'dark'"
      [class.brand__icon-shell--auto]="variant === 'auto'"
    >
      <img
        class="brand__icon-image brand__icon-image--light"
        src="assets/branding/logo-user-light-v2.png"
        alt=""
        decoding="async"
      />
      <img
        class="brand__icon-image brand__icon-image--dark"
        src="assets/branding/logo-user-dark-v2.png"
        alt=""
        decoding="async"
      />
    </span>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BrandMarkComponent {
  @Input() variant: "auto" | "light" | "dark" = "auto";
}

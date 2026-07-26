import { inject } from "@angular/core";
import { CanActivateFn, Router, Routes } from "@angular/router";

import { AuthService } from "./core/services/auth.service";
import { ArticlePageComponent } from "./pages/article-page/article-page.component";
import { DashboardPageComponent } from "./pages/dashboard-page/dashboard-page.component";
import { HomePageComponent } from "./pages/home-page/home-page.component";
import { LoginPageComponent } from "./pages/login-page/login-page.component";
import { SubscriptionStatusPageComponent } from "./pages/subscription-status-page/subscription-status-page.component";

const authGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const user = await authService.restoreSession();

  return user ? true : router.createUrlTree(["/login"]);
};

const guestGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const user = await authService.restoreSession();

  return user ? router.createUrlTree(["/dashboard"]) : true;
};

export const routes: Routes = [
  {
    path: "",
    component: HomePageComponent
  },
  {
    path: "login",
    canActivate: [guestGuard],
    component: LoginPageComponent
  },
  {
    path: "dashboard",
    canActivate: [authGuard],
    component: DashboardPageComponent
  },
  {
    path: "articulo/:slug",
    component: ArticlePageComponent
  },
  {
    path: "boletin/:action",
    component: SubscriptionStatusPageComponent
  },
  {
    path: "**",
    redirectTo: ""
  }
];

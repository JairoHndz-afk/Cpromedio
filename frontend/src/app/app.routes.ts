import { inject } from "@angular/core";
import { CanActivateFn, Router, Routes } from "@angular/router";

import { AuthService } from "./core/services/auth.service";
import { ArticlePageComponent } from "./pages/article-page/article-page.component";
import { ArchivePageComponent } from "./pages/archive-page/archive-page.component";
import { AuthorPageComponent } from "./pages/author-page/author-page.component";
import { DashboardPageComponent } from "./pages/dashboard-page/dashboard-page.component";
import { HomePageComponent } from "./pages/home-page/home-page.component";
import { LoginPageComponent } from "./pages/login-page/login-page.component";
import { PrivacyPageComponent } from "./pages/privacy-page/privacy-page.component";
import { ReaderAccountPageComponent } from "./pages/reader-account-page/reader-account-page.component";
import { ReaderRegisterPageComponent } from "./pages/reader-register-page/reader-register-page.component";
import { ReaderSubscriptionManagePageComponent } from "./pages/reader-subscription-manage-page/reader-subscription-manage-page.component";
import { SubscriptionStatusPageComponent } from "./pages/subscription-status-page/subscription-status-page.component";

function resolveAuthenticatedLandingPath(user: Awaited<ReturnType<AuthService["restoreSession"]>>): string {
  return user?.role === "reader" ? "/cuenta" : "/dashboard";
}

const authGuard: CanActivateFn = async (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const user = await authService.restoreSession();

  return user
    ? true
    : router.createUrlTree(["/login"], {
        queryParams: {
          redirect: state.url
        }
      });
};

const guestGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const user = await authService.restoreSession();

  return user ? router.createUrlTree([resolveAuthenticatedLandingPath(user)]) : true;
};

const editorialGuard: CanActivateFn = async (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const user = await authService.restoreSession();

  if (!user) {
    return router.createUrlTree(["/login"], {
      queryParams: {
        redirect: state.url
      }
    });
  }

  return user.role === "reader" ? router.createUrlTree(["/cuenta"]) : true;
};

const readerGuard: CanActivateFn = async (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const user = await authService.restoreSession();

  if (!user) {
    return router.createUrlTree(["/login"], {
      queryParams: {
        redirect: state.url
      }
    });
  }

  return user.role === "reader" ? true : router.createUrlTree(["/dashboard"]);
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
    path: "registro",
    canActivate: [guestGuard],
    component: ReaderRegisterPageComponent
  },
  {
    path: "lectores/registro",
    canActivate: [guestGuard],
    component: ReaderRegisterPageComponent
  },
  {
    path: "cuenta",
    canActivate: [readerGuard],
    component: ReaderAccountPageComponent
  },
  {
    path: "archivo",
    component: ArchivePageComponent
  },
  {
    path: "privacidad",
    component: PrivacyPageComponent
  },
  {
    path: "dashboard",
    canActivate: [editorialGuard],
    component: DashboardPageComponent
  },
  {
    path: "articulo/:slug",
    component: ArticlePageComponent
  },
  {
    path: "autor/:authorId",
    component: AuthorPageComponent
  },
  {
    path: "boletin/gestionar",
    component: ReaderSubscriptionManagePageComponent
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

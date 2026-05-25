package io.droidevs.docai.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * FIX #15 — Maps URL paths to Thymeleaf templates.
 *
 * Without these mappings every GET to /dashboard, /chat, /documents, etc.
 * returns 404 because no @Controller handles them.  Simple view-only routes
 * don't need a full @Controller — WebMvcConfigurer.addViewControllers is the
 * idiomatic Spring MVC way to register them.
 *
 * Pages that need server-side model attributes (e.g. admin data pre-rendered
 * by Thymeleaf) should be moved to a proper @Controller instead.
 */
@Configuration
public class MvcConfig implements WebMvcConfigurer {

    @Override
    public void addViewControllers(ViewControllerRegistry registry) {
        // Auth pages
        registry.addViewController("/login").setViewName("login");
        registry.addViewController("/register").setViewName("register");

        // Main app pages
        registry.addViewController("/dashboard").setViewName("dashboard");
        registry.addViewController("/documents").setViewName("documents");
        registry.addViewController("/upload").setViewName("upload");
        registry.addViewController("/chat").setViewName("chat");
        registry.addViewController("/search").setViewName("search");
        registry.addViewController("/profile").setViewName("profile");

        // Admin (URL-level guard is in SecurityConfig; the template also uses
        // sec:authorize so non-admins see nothing even if they reach the view)
        registry.addViewController("/admin").setViewName("admin");

        // Root redirect to dashboard
        registry.addRedirectViewController("/", "/dashboard");
    }
}

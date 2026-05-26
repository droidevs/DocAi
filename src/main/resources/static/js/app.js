/**
 * DocAI — Global Frontend Utility (window.DocAI)
 * Provides authenticated API helpers and toast notifications.
 *
 * FIX #19: This file was missing entirely.
 * FIX #35: File was placed under src/main/resources/templates/js/app.js —
 *          Thymeleaf's template resolver treats that directory as its root for
 *          .html templates, but it does NOT serve arbitrary files from it as
 *          static assets.  Spring Boot's ResourceHandler only serves files
 *          from src/main/resources/static/ (and /public, /resources,
 *          /META-INF/resources).  Every page that referenced th:src="@{/js/app.js}"
 *          received a 404 because the file was never reachable via HTTP.
 *          Correct location: src/main/resources/static/js/app.js
 */
(function () {
    'use strict';

    // ── Token management ─────────────────────────────────────────────────
    function getToken() {
        return localStorage.getItem('jwt_token') || null;
    }

    function setToken(token) {
        if (token) localStorage.setItem('jwt_token', token);
    }

    function clearToken() {
        localStorage.removeItem('jwt_token');
    }

    // ── Fetch helpers ────────────────────────────────────────────────────
    function authHeaders(extra) {
        const token = getToken();
        const headers = { 'Content-Type': 'application/json', ...extra };
        if (token) headers['Authorization'] = 'Bearer ' + token;
        const csrfToken  = document.querySelector('meta[name="_csrf"]')?.content;
        const csrfHeader = document.querySelector('meta[name="_csrf_header"]')?.content;
        if (csrfToken && csrfHeader) headers[csrfHeader] = csrfToken;
        return headers;
    }

    async function request(method, url, body) {
        const options = {
            method,
            headers: authHeaders(),
            credentials: 'include',
        };
        if (body !== undefined) options.body = JSON.stringify(body);

        const res = await fetch(url, options);

        if (res.status === 401) {
            clearToken();
            window.location.href = '/login';
            throw new Error('Session expired — please log in again.');
        }

        if (res.status === 204) return null;

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            const msg = data.detail || data.message || `Request failed (${res.status})`;
            throw new Error(msg);
        }

        return data;
    }

    // ── Public API ───────────────────────────────────────────────────────
    const DocAI = {
        get:  (url)        => request('GET',    url),
        post: (url, body)  => request('POST',   url, body),
        put:  (url, body)  => request('PUT',    url, body ?? {}),
        patch:(url, body)  => request('PATCH',  url, body),
        del:  (url)        => request('DELETE', url),

        upload(url, formData) {
            const token = getToken();
            const headers = { credentials: 'include' };
            if (token) headers['Authorization'] = 'Bearer ' + token;
            return fetch(url, { method: 'POST', headers, body: formData, credentials: 'include' });
        },

        setToken,
        getToken,
        clearToken,

        /**
         * @param {string} message
         * @param {'success'|'danger'|'warning'|'info'} type
         * @param {number} [duration=4000]
         */
        toast(message, type = 'info', duration = 4000) {
            const container = document.getElementById('toastContainer');
            if (!container) { console.warn('DocAI.toast: no #toastContainer'); return; }

            const iconMap = {
                success: 'bi-check-circle-fill text-success',
                danger:  'bi-exclamation-circle-fill text-danger',
                warning: 'bi-exclamation-triangle-fill text-warning',
                info:    'bi-info-circle-fill text-info',
            };
            const icon = iconMap[type] || iconMap.info;

            const id   = 'toast-' + Date.now();
            const html = `
<div id="${id}" class="toast align-items-center border-0 shadow-sm" role="alert" aria-live="assertive" aria-atomic="true">
  <div class="d-flex">
    <div class="toast-body d-flex align-items-center gap-2">
      <i class="bi ${icon}"></i>
      <span>${escHtml(message)}</span>
    </div>
    <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
  </div>
</div>`;
            container.insertAdjacentHTML('beforeend', html);
            const el      = document.getElementById(id);
            const bsToast = new bootstrap.Toast(el, { delay: duration });
            bsToast.show();
            el.addEventListener('hidden.bs.toast', () => el.remove());
        },
    };

    // ── Sidebar toggle (mobile) ──────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', () => {
        const toggleBtn = document.getElementById('sidebarToggle');
        const sidebar   = document.getElementById('sidebar');
        if (toggleBtn && sidebar) {
            toggleBtn.addEventListener('click', () => sidebar.classList.toggle('sidebar-open'));
        }
    });

    // ── Shared utility ───────────────────────────────────────────────────
    function escHtml(s) {
        return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    window.DocAI = DocAI;
})();
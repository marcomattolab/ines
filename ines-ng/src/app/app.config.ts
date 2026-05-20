import { ApplicationConfig, provideBrowserGlobalErrorListeners, isDevMode, importProvidersFrom } from '@angular/core';
import { provideServiceWorker } from '@angular/service-worker';
import { LucideAngularModule, MessageSquare, Mail, Mic, Languages, CheckSquare, Code, Send, Trash2, Copy, Plus, RefreshCw, X, Loader2, AlertCircle, CheckCircle2, Download } from 'lucide-angular';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    importProvidersFrom(
      LucideAngularModule.pick({
        MessageSquare,
        Mail,
        Mic,
        Languages,
        CheckSquare,
        Code,
        Send,
        Trash2,
        Copy,
        Plus,
        RefreshCw,
        X,
        Loader2,
        AlertCircle,
        CheckCircle2,
        Download
      })
    )
  ],
};

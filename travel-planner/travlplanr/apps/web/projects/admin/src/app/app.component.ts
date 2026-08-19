import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastHostComponent, ConfirmDialogHostComponent } from 'ui';

@Component({
    selector: 'app-root',
    imports: [RouterOutlet, ToastHostComponent, ConfirmDialogHostComponent],
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'admin';
}

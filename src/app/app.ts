import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import {routes} from './app.routes';
import { NgModule } from '@angular/core';

@Component({
  selector: 'app-root',
    standalone: true,
  imports: [RouterOutlet, FormsModule, CommonModule, RouterModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('TimeSheet-UI');
}

import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { Api } from '../services/api';
import { environment } from '../../environments/environment';
import { map} from 'rxjs/operators';    


@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
  animations: [
    trigger('fadeIn', [
      state('void', style({ opacity: 0, transform: 'translateY(30px)' })),
      transition(':enter', [
        animate('0.8s ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ]
})
export class LoginComponent {
  username = signal('');
  password = signal('');
  showPassword = signal(false);
  isLoggingIn = signal(false);

  email: string = '';
  newPassword: string = '';
  confirmPassword: string = '';
  forgotPasswordVisible: boolean = false;
  loginErrorMessage: string = '';
  isEmailDisabled: boolean = true;

  PasswordseterrorMessage: string = '';
  PasswordsetsuccessMessage: string = '';

  toggleForgotPassword(): void {
    this.forgotPasswordVisible = !this.forgotPasswordVisible;
  }

  private base = environment.apiBaseUrl;

  constructor(private router: Router, private api: Api) {}


  togglePasswordVisibility() {
    this.showPassword.update(show => !show);
  }

    isPasswordValid(): boolean {
    const passwordPattern = /^(?=.*\d).{6,}$/; 
    return passwordPattern.test(this.password());
  }

  isEmailValid(): boolean {
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/; 
    return emailPattern.test(this.username());  
  }


  
  onLogin() {
    
    this.loginErrorMessage = '';

    if (!this.isEmailValid() || !this.isPasswordValid()) {

      this.loginErrorMessage = 'Please enter a valid username and password (at least 6 characters including a number).';
      return;
    }

    this.isLoggingIn.set(true);

    this.api.login(this.username(), this.password()).subscribe({
      next: (res) => {

        console.log('Login response:', res);

        if (res?.success === true && res?.data) {
          
          const token = res?.token || res?.access_token;
          if (token) {
            localStorage.setItem('access_token', token);

            localStorage.setItem('current_user', JSON.stringify(res.data));

          }
          this.router.navigate(['/employee-dashboard']);

        } else if (res?.message === "FIRST_LOGIN") {
          // 🔄 First login – redirect to set new password UI

          this.forgotPasswordVisible = true; 

          if (this.forgotPasswordVisible) {
            this.newPassword = '';
            this.confirmPassword ='';
            this.email = '';
          } else {
            this.username.set('');
            this.password.set('');
          }

          this.isEmailDisabled = !this.isEmailDisabled;

         this.email = this.username();

        } else {
          // ❌ Failed login
          this.loginErrorMessage = (res?.message || 'Login failed');
        }
      },
      error: (err) => {
        console.error('Login failed', err);
        this.loginErrorMessage = ('Unexpected error occurred during login');
        this.isLoggingIn.set(false);
      },
      complete: () => this.isLoggingIn.set(false)
    });

  
  }

  


  onForgotPassword() {

    this.forgotPasswordVisible = true; 

    if (this.forgotPasswordVisible) {
      this.newPassword = '';
      this.confirmPassword ='';
      this.email = '';
    } else {
      this.username.set('');
      this.password.set('');
    }

  }

  logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('current_user');
  }

  getToken(): string | null {
    return localStorage.getItem('access_token');
  }

  isLoggedIn(): boolean {
    const t = this.getToken();
    if (!t) return false;
    // optionally check expiry using jwt-decode or @auth0/angular-jwt
    return true;
  }

  onResetPassword() {
    if (this.newPassword === this.confirmPassword) {
      this.api.setpassword(this.email, this.newPassword).subscribe({
        next: (res) => {
          if (res?.status === "Y") {
            this.PasswordsetsuccessMessage = 'Password reset successful. Please log in with your new password.';
            this.forgotPasswordVisible = true; // Hide the reset email form
          } else {
            this.PasswordseterrorMessage = res?.message || 'Password reset failed';
          }
        },
        error: (err) => {
          console.error('Password reset failed', err);
           this.PasswordseterrorMessage = 'Unexpected error occurred during password reset';
        }
      });

      
    } else {
      alert("Passwords do not match.");
    }
  }


  
  goBackToLogin() {
    
    this.username.set('');
    this.password.set('');
    
    this.forgotPasswordVisible = true;

  }



}



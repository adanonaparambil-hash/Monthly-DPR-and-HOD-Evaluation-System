import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { Api } from '../services/api';
import { environment } from '../../environments/environment';
import { map} from 'rxjs/operators';  
import { ToastrService } from 'ngx-toastr';  


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

  constructor(private router: Router, private api: Api,private toastr: ToastrService) {}


  togglePasswordVisibility() {
    this.showPassword.update(show => !show);
  }

  isPasswordValid(): boolean {
    const passwordPattern = /^(?=.*\d).{6,}$/; 
    return passwordPattern.test(this.password());
  }

  isUserIdValid(): boolean {
    const userIdPattern = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{4,}$/;
    return userIdPattern.test(this.username());
  }



  
  onLogin() {
    
    this.loginErrorMessage = '';

    if (!this.isUserIdValid()) {
        this.toastr.error('Please enter a valid username (at least 4 characters, including both letters and numbers).', 'Invalid User ID');
        return;
    }

    if (!this.isPasswordValid()) {
        this.toastr.error('Please enter a valid password (at least 6 characters, including a number).', 'Invalid Password');
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
        
          this.toastr.error(res?.message || 'Login failed', 'Error');

        }
      },
      error: (err) => {
        this.toastr.error('Unexpected error occurred during login', 'Error');
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

             this.toastr.success('Password reset successful. Please log in with your new password.', 'Success');

            this.forgotPasswordVisible = true;
          } else {

            this.toastr.error(res?.message || 'Password reset failed', 'Error');

          }
        },
        error: (err) => {

          this.toastr.error('Unexpected error occurred during password reset', 'Error');

        }
      });

      
    } else {

      this.toastr.error('Passwords do not match.', 'Error');

    }
  }


  
  goBackToLogin() {
    
    this.username.set('');
    this.password.set('');
    
    this.forgotPasswordVisible = true;

  }



}



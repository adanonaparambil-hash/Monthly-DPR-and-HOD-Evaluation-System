import { Component, signal, OnDestroy } from '@angular/core';
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
export class LoginComponent implements OnDestroy {
  username = signal('');
  password = signal('');
  showPassword = signal(false);
  isLoggingIn = signal(false);

  // Multi-step form states
  currentView: 'login' | 'forgot-password' | 'signup' = 'login';
  currentStep: 'email' | 'otp' | 'password' = 'email';
  
  // Form data
  email: string = '';
  otp: string = '';
  newPassword: string = '';
  confirmPassword: string = '';
  
  // Signup specific fields
  fullName: string = '';
  employeeId: string = '';
  department: string = '';
  designation: string = '';
  
  // UI states
  isEmailDisabled: boolean = true;
  isProcessing: boolean = false;
  otpSent: boolean = false;
  otpTimer: number = 0;
  otpInterval: any;
  
  // Messages
  errorMessage: string = '';
  successMessage: string = '';
  loginErrorMessage: string = '';
  
  // Legacy properties for compatibility
  forgotPasswordVisible: boolean = false;

  toggleForgotPassword(): void {
    this.currentView = 'forgot-password';
    this.currentStep = 'email';
    this.resetForm();
  }

  toggleSignup(): void {
    this.currentView = 'signup';
    this.currentStep = 'email';
    this.resetForm();
  }

  backToLogin(): void {
    this.currentView = 'login';
    this.resetForm();
  }

  resetForm(): void {
    this.email = '';
    this.otp = '';
    this.newPassword = '';
    this.confirmPassword = '';
    this.fullName = '';
    this.employeeId = '';
    this.department = '';
    this.designation = '';
    this.errorMessage = '';
    this.successMessage = '';
    this.otpSent = false;
    this.clearOtpTimer();
  }

  private base = environment.apiBaseUrl;

  constructor(private router: Router, private api: Api, private toastr: ToastrService) {}


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
    this.errorMessage = '';

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

        } else if (res?.message === "F") {
          

          this.toastr.info('Please set your password using Sign Up, then log in.', 'Password Setup Required');

          // this.currentView = 'forgot-password';
          // this.currentStep = 'password';
          // this.email = this.username();
          // this.newPassword = '';
          // this.confirmPassword = '';

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

    
  onSubmitEmail() {
    if (!this.isValidEmail(this.email)) {
      this.toastr.error('Please enter a valid email address');
      return;
    }

    this.isProcessing = true;

    this.api.sendOtp(this.email).subscribe(
      (response: any) => {
        this.isProcessing = false;
        if (response.success) {
          this.otpSent = true;
          this.currentStep = 'otp';
          this.toastr.success('OTP sent to your email address');
        } else {
          this.toastr.error(response.Message); 
        }
      },
      (error) => {
        this.isProcessing = false;
        this.toastr.error('There was an error sending the OTP. Please try again.');
      }
    );
  }


  onVerifyOtp() {
    if (this.otp.length !== 6) {
      this.toastr.error('OTP should be 6 digits long');
      return;
    }

    this.isProcessing = true;

    this.api.verifyOtp(this.email, this.otp).subscribe(
      (response: any) => {
        this.isProcessing = false;
        if (response.isValid) {
          this.toastr.success('OTP verified successfully!');
          this.currentStep = 'password';
        } else {
          this.toastr.error('Invalid OTP. Please try again.');
        }
      },
      (error) => {
        this.isProcessing = false;
        this.toastr.error('There was an error verifying the OTP. Please try again.');
      }
    );
  }

 
  onResendOtp() {
    this.isProcessing = true;  

    this.api.ResendOtp(this.email).subscribe(
      (response: any) => {
        this.isProcessing = false;  

        if (response.success) {
          
          this.startOtpTimer();
          this.toastr.success('OTP resent to your email address');  
        } else {
          
          this.toastr.error(response.Message || 'There was an error resending the OTP. Please try again.');
        }
      },
      (error) => {
        this.isProcessing = false; 
        this.toastr.error('There was an error resending the OTP. Please try again.');
      }
    );
  }


  onSetPassword() {
  // Step 1: Validate password
  if (!this.isValidPassword(this.newPassword)) {
    this.errorMessage = 'Password must be at least 6 characters long and contain at least one number';
    return;
  }

  // Step 2: Confirm passwords match
  if (this.newPassword !== this.confirmPassword) {
    this.errorMessage = 'Passwords do not match';
    return;
  }

  // Step 3: Call the backend API
  this.isProcessing = true;
  this.errorMessage = '';

  this.api.setpassword(this.username(), this.newPassword).subscribe({
    next: (response) => {
      this.isProcessing = false;

      if (response && response.success) {
       
        if (this.currentView === 'forgot-password') {
          this.toastr.success(response.message || 'Password reset successful. Please log in with your new password.', 'Success');
          this.backToLogin();
        } else if (this.currentView === 'signup') {
          this.toastr.success(response.message || 'Account created successfully. Please log in with your credentials.', 'Success');
          this.backToLogin();
        } else {
          this.toastr.success(response.message || 'Password set successfully.', 'Success');
          this.backToLogin();
        }
      } else {
  
        this.errorMessage = response?.message || 'Unable to set password. Please try again.';
      }
    },
    error: (error) => {
      this.isProcessing = false;
      console.error('Password set failed:', error);
      this.errorMessage = error.error?.message || 'An error occurred while setting the password.';
    }
  });
}



  // Signup completion
  onCompleteSignup() {
    if (!this.fullName || !this.employeeId || !this.department || !this.designation) {
      this.errorMessage = 'Please fill in all required fields';
      return;
    }

    this.onSetPassword();
  }

  // Utility methods
  isValidEmail(email: string): boolean {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailPattern.test(email);
  }

  isValidPassword(password: string): boolean {
    const passwordPattern = /^(?=.*\d).{6,}$/;
    return passwordPattern.test(password);
  }

  startOtpTimer() {
    this.otpTimer = 60;
    this.otpInterval = setInterval(() => {
      this.otpTimer--;
      if (this.otpTimer <= 0) {
        this.clearOtpTimer();
      }
    }, 1000);
  }

  clearOtpTimer() {
    if (this.otpInterval) {
      clearInterval(this.otpInterval);
      this.otpInterval = null;
    }
    this.otpTimer = 0;
  }

  // Navigation helpers
  getStepTitle(): string {
    if (this.currentView === 'login') return 'Welcome Back!';
    
    const titles: { [key: string]: { [key: string]: string } } = {
      'forgot-password': {
        'email': 'Reset Password',
        'otp': 'Verify OTP',
        'password': 'Set New Password'
      },
      'signup': {
        'email': 'Create Account',
        'otp': 'Verify Email',
        'password': 'Complete Registration'
      }
    };
    
    return titles[this.currentView]?.[this.currentStep] || 'Authentication';
  }

  getStepDescription(): string {
    if (this.currentView === 'login') return 'Sign in to access your dashboard';
    
    const descriptions: { [key: string]: { [key: string]: string } } = {
      'forgot-password': {
        'email': 'Enter your email address to receive a reset code',
        'otp': 'Enter the 6-digit code sent to your email',
        'password': 'Create a new password for your account'
      },
      'signup': {
        'email': 'Enter your email address to get started',
        'otp': 'Enter the 6-digit verification code sent to your email',
        'password': 'Complete your profile and set a password'
      }
    };
    
    return descriptions[this.currentView]?.[this.currentStep] || '';
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
    return true;
  }

  ngOnDestroy() {
    this.clearOtpTimer();
  }



}



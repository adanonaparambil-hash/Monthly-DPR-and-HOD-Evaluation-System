import { Component, signal, OnDestroy, OnInit, HostListener, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { Api } from '../services/api';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';
import { map} from 'rxjs/operators';  
import { ToastrService } from 'ngx-toastr';  

interface Particle {
  x: number;
  y: number;
  delay: number;
  duration: number;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
  animations: [
    trigger('fadeIn', [
      state('void', style({ opacity: 0, transform: 'translateY(30px)' })),
      transition(':enter', [
        animate('0.8s ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ]
})
export class LoginComponent implements OnInit, OnDestroy {
  @ViewChild('loginContainer', { static: false }) loginContainer!: ElementRef;
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

  // Parallax and animation properties
  particles: Particle[] = [];
  mouseX: number = 0;
  mouseY: number = 0;
  scrollY: number = 0;
  
  // Background image path that works with baseHref
  backgroundImageUrl: string = 'assets/images/AlAdrakBgImage.jpg';

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

  constructor(
    private router: Router, 
    private api: Api, 
    private authService: AuthService,
    private toastr: ToastrService,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.initializeParticles();
    this.startParallaxAnimations();
    
    // Check for various logout reasons
    this.route.queryParams.subscribe(params => {
      if (params['sessionExpired'] === 'true') {
        this.toastr.warning('Your session has expired. Please login again.', 'Session Expired');
        this.loginErrorMessage = 'Your session has expired. Please login again.';
      } else if (params['inactivity'] === 'true') {
        this.toastr.info('You have been logged out due to inactivity.', 'Logged Out');
        this.loginErrorMessage = 'You have been logged out due to inactivity.';
      } else if (params['unauthorized'] === 'true') {
        this.toastr.error('Access denied. Please login again.', 'Access Denied');
        this.loginErrorMessage = 'Access denied. Please login again.';
      }
      
      // Clean up URL parameters after showing message
      setTimeout(() => {
        this.authService.cleanupUrlParameters();
      }, 100);
    });
  }

  private rafId: number | null = null;

  @HostListener('mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    this.mouseX = (event.clientX / window.innerWidth) * 100;
    this.mouseY = (event.clientY / window.innerHeight) * 100;
    
    // Use requestAnimationFrame to throttle updates
    if (!this.rafId) {
      this.rafId = requestAnimationFrame(() => {
        this.updateParallaxLayers();
        this.rafId = null;
      });
    }
  }

  @HostListener('window:resize')
  onResize() {
    this.initializeParticles();
  }

  private initializeParticles() {
    // Removed heavy particle generation
    this.particles = [];
  }

  private startParallaxAnimations() {
    // Lightweight mouse parallax only - no continuous animation needed
  }

  private updateParallaxLayers() {
    // GPU-friendly parallax effect using transform only
    const card = document.querySelector('.auth-card') as HTMLElement;
    const forgotCard = document.querySelector('.forgot-password-card') as HTMLElement;
    const floatingShapes = document.querySelectorAll('.floating-circle');
    const spotlight = document.querySelector('.cursor-spotlight') as HTMLElement;
    const backgroundOverlay = document.querySelector('.background-overlay') as HTMLElement;
    const darkOverlay = document.querySelector('.dark-overlay') as HTMLElement;
    
    // Move the card based on mouse position (subtle)
    if (card) {
      const xOffset = (this.mouseX - 50) * 0.2;
      const yOffset = (this.mouseY - 50) * 0.2;
      card.style.transform = `translate3d(${xOffset}px, ${yOffset}px, 0)`;
    }

    if (forgotCard) {
      const xOffset = (this.mouseX - 50) * 0.2;
      const yOffset = (this.mouseY - 50) * 0.2;
      forgotCard.style.transform = `translate3d(${xOffset}px, ${yOffset}px, 0)`;
    }

    // Move floating circles with cursor
    floatingShapes.forEach((shape, index) => {
      const speed = 0.08 + (index * 0.04);
      const xOffset = (this.mouseX - 50) * speed;
      const yOffset = (this.mouseY - 50) * speed;
      
      (shape as HTMLElement).style.transform = 
        `translate3d(${xOffset}px, ${yOffset}px, 0)`;
    });

    // Subtle background parallax (1-3px shift)
    if (backgroundOverlay) {
      const xOffset = (this.mouseX - 50) * 0.03;
      const yOffset = (this.mouseY - 50) * 0.03;
      backgroundOverlay.style.transform = `translate3d(${xOffset}px, ${yOffset}px, 0)`;
    }

    // Fluid gradient that follows mouse
    if (darkOverlay) {
      darkOverlay.style.setProperty('--mouse-x', `${this.mouseX}%`);
      darkOverlay.style.setProperty('--mouse-y', `${this.mouseY}%`);
    }

    // Cursor spotlight effect
    if (spotlight) {
      const x = (this.mouseX / 100) * window.innerWidth;
      const y = (this.mouseY / 100) * window.innerHeight;
      spotlight.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
    }
  }


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
            // Use AuthService for proper session management
            this.authService.login(token, res.data);
          }
          
          const code = (res?.data?.isHOD || '').toString().toUpperCase();
          if (code === 'H') {
            this.router.navigate(['/hod-dashboard']);
          } else if (code === 'C') {
            this.router.navigate(['/ced-dashboard']);
          } else {
            this.router.navigate(['/employee-dashboard']);
          }

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
          this.startOtpTimer(120);
        } else {
          this.toastr.error(response.message); 
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
        if (response.success) {
          this.toastr.success('OTP verified successfully!');
          this.currentStep = 'password';
          this.employeeId = this.email;
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
          
          this.startOtpTimer(120);
          this.toastr.success('OTP resent to your email address');  
        } else {
          
          this.toastr.error(response.message || 'There was an error resending the OTP. Please try again.');
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

  const userIdForPassword = this.employeeId?.trim() || this.username();
  this.api.setpassword(userIdForPassword, this.newPassword).subscribe({
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

  startOtpTimer(seconds: number = 120) {
    this.clearOtpTimer();
    this.otpTimer = seconds;
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
        'email': 'Setup Account',
        'otp': 'Verify Email',
        'password': 'Complete Account Setup'
      }
    };
    
    return titles[this.currentView]?.[this.currentStep] || 'Authentication';
  }

  getStepDescription(): string {
    if (this.currentView === 'login') return '';
    
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

  ngOnDestroy() {
    this.clearOtpTimer();
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
  }



}



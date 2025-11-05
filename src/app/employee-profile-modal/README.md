# Employee Profile Modal Component

A modern, responsive modal component that displays comprehensive employee profile information including personal details, skills, and career summary.

## Features

- 🎨 Modern glassmorphic design
- 📱 Fully responsive (desktop, tablet, mobile)
- 🔄 Loading states and animations
- 📊 Profile completion progress bar
- 🏷️ Skills displayed as interactive chips
- 📝 Career summary section
- 🖼️ Profile photo display
- ⚡ Smooth animations and transitions

## Usage

### 1. Import the Component

```typescript
import { EmployeeProfileModalComponent } from '../employee-profile-modal/employee-profile-modal.component';

@Component({
  selector: 'your-component',
  standalone: true,
  imports: [CommonModule, EmployeeProfileModalComponent],
  // ...
})
```

### 2. Add to Template

```html
<app-employee-profile-modal
  [employeeId]="selectedEmployeeId"
  [isVisible]="showModal"
  (closeModal)="onCloseModal()">
</app-employee-profile-modal>
```

### 3. Component Properties

```typescript
export class YourComponent {
  selectedEmployeeId: string = '';
  showModal: boolean = false;

  openEmployeeProfile(empId: string) {
    this.selectedEmployeeId = empId;
    this.showModal = true;
  }

  onCloseModal() {
    this.showModal = false;
    this.selectedEmployeeId = '';
  }
}
```

## API Integration

The component automatically calls the `GetEmployeeProfile(empId)` API method to fetch employee data. Make sure your API service includes this method.

### Expected API Response Format

```typescript
{
  success: boolean;
  message: string;
  data: {
    employeeName: string;
    email: string;
    department: string;
    designation: string;
    empId: string;
    location: string;
    phone: string;
    careerSummary: string;
    experienceInd: number;
    experienceAbroad: number;
    qualification: string;
    skillset: string; // comma-separated values
    doj: string; // join date
    address: string;
    telephone: string;
    nation: string;
    postOffice: string;
    state: string;
    district: string;
    place: string;
    profileImageBase64?: string; // base64 encoded image
  }
}
```

## Styling

The component uses CSS custom properties for theming and supports both light and dark modes. All styles are scoped to the component.

## Example Implementation (CED Dashboard)

```typescript
// In your component
viewEmployeeProfile(employee: Employee) {
  this.selectedEmployeeId = employee.id;
  this.showProfileModal = true;
}

closeProfileModal() {
  this.showProfileModal = false;
  this.selectedEmployeeId = '';
}
```

```html
<!-- In your template -->
<div class="employee-avatar" (click)="viewEmployeeProfile(employee)">
  <img [src]="employee.profileImage" [alt]="employee.name" />
</div>

<app-employee-profile-modal
  [employeeId]="selectedEmployeeId"
  [isVisible]="showProfileModal"
  (closeModal)="closeProfileModal()">
</app-employee-profile-modal>
```

## Responsive Behavior

- **Desktop**: Full-width modal with side-by-side layout
- **Tablet**: Stacked layout with responsive grid
- **Mobile**: Full-screen modal with single-column layout

## Accessibility

- Keyboard navigation support
- Screen reader friendly
- Focus management
- ARIA labels and roles
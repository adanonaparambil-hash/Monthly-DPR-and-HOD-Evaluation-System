import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Department {
    id: string;
    name: string;
    totalEmployees: number;
    submittedMPR: number;
    pendingMPR: number;
    approvedMPR: number;
    color: string;
    icon: string;
}

interface Employee {
    id: string;
    name: string;
    profileImage: string;
    month: string;
    year: string;
    status: 'submitted' | 'pending' | 'approved';
    score: number;
    rank: number;
    department: string;
}

@Component({
    selector: 'app-ced-dashboard-new',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './ced-dashboard-new.component.html',
    styleUrls: ['./ced-dashboard-new.component.css']
})
export class CedDashboardNewComponent implements OnInit, AfterViewInit, OnDestroy {
    selectedMonth: string = 'October';
    selectedYear: string = '2024';
    currentView: 'departments' | 'employees' = 'departments';
    selectedDepartment: Department | null = null;
    searchQuery: string = '';
    filteredEmployees: Employee[] = [];

    months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    years = ['2024', '2023', '2022'];

    departments: Department[] = [
        {
            id: '1',
            name: 'Engineering',
            totalEmployees: 45,
            submittedMPR: 38,
            pendingMPR: 5,
            approvedMPR: 33,
            color: 'dept-engineering',
            icon: 'fas fa-code'
        },
        {
            id: '2',
            name: 'Marketing',
            totalEmployees: 23,
            submittedMPR: 20,
            pendingMPR: 2,
            approvedMPR: 18,
            color: 'dept-marketing',
            icon: 'fas fa-bullhorn'
        },
        {
            id: '3',
            name: 'Sales',
            totalEmployees: 32,
            submittedMPR: 28,
            pendingMPR: 3,
            approvedMPR: 25,
            color: 'dept-sales',
            icon: 'fas fa-chart-line'
        },
        {
            id: '4',
            name: 'HR',
            totalEmployees: 12,
            submittedMPR: 11,
            pendingMPR: 1,
            approvedMPR: 10,
            color: 'dept-hr',
            icon: 'fas fa-users'
        },
        {
            id: '5',
            name: 'Finance',
            totalEmployees: 18,
            submittedMPR: 16,
            pendingMPR: 1,
            approvedMPR: 15,
            color: 'dept-finance',
            icon: 'fas fa-calculator'
        },
        {
            id: '6',
            name: 'Operations',
            totalEmployees: 28,
            submittedMPR: 24,
            pendingMPR: 3,
            approvedMPR: 21,
            color: 'dept-operations',
            icon: 'fas fa-cogs'
        }
    ];

    // Icons for different stats
    statIcons = {
        totalEmployees: 'fas fa-users',
        submittedMPR: 'fas fa-upload',
        pendingMPR: 'fas fa-clock',
        approvedMPR: 'fas fa-check-circle'
    };

    employees: Employee[] = [
        // Engineering Department
        {
            id: '1',
            name: 'Sarah Johnson',
            profileImage: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=60&h=60&fit=crop&crop=face&auto=format',
            month: 'October',
            year: '2024',
            status: 'approved',
            score: 96,
            rank: 1,
            department: 'Engineering'
        },
        {
            id: '2',
            name: 'Michael Chen',
            profileImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=60&h=60&fit=crop&crop=face&auto=format',
            month: 'October',
            year: '2024',
            status: 'approved',
            score: 94,
            rank: 2,
            department: 'Engineering'
        },
        {
            id: '3',
            name: 'Emily Davis',
            profileImage: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=60&h=60&fit=crop&crop=face&auto=format',
            month: 'October',
            year: '2024',
            status: 'submitted',
            score: 92,
            rank: 3,
            department: 'Engineering'
        },
        {
            id: '4',
            name: 'Robert Taylor',
            profileImage: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=60&h=60&fit=crop&crop=face&auto=format',
            month: 'October',
            year: '2024',
            status: 'pending',
            score: 91,
            rank: 4,
            department: 'Engineering'
        },
        {
            id: '5',
            name: 'Lisa Anderson',
            profileImage: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=60&h=60&fit=crop&crop=face&auto=format',
            month: 'October',
            year: '2024',
            status: 'approved',
            score: 89,
            rank: 5,
            department: 'Engineering'
        },

        // Marketing Department
        {
            id: '6',
            name: 'Jessica Martinez',
            profileImage: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60&h=60&fit=crop&crop=face&auto=format',
            month: 'October',
            year: '2024',
            status: 'approved',
            score: 95,
            rank: 1,
            department: 'Marketing'
        },
        {
            id: '7',
            name: 'David Wilson',
            profileImage: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=60&h=60&fit=crop&crop=face&auto=format',
            month: 'October',
            year: '2024',
            status: 'submitted',
            score: 88,
            rank: 2,
            department: 'Marketing'
        },
        {
            id: '8',
            name: 'Amanda Brown',
            profileImage: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=60&h=60&fit=crop&crop=face&auto=format',
            month: 'October',
            year: '2024',
            status: 'pending',
            score: 85,
            rank: 3,
            department: 'Marketing'
        },

        // Sales Department
        {
            id: '9',
            name: 'James Rodriguez',
            profileImage: 'https://images.unsplash.com/photo-1519244703995-f4e0f30006d5?w=60&h=60&fit=crop&crop=face&auto=format',
            month: 'October',
            year: '2024',
            status: 'approved',
            score: 93,
            rank: 1,
            department: 'Sales'
        },
        {
            id: '10',
            name: 'Maria Garcia',
            profileImage: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=60&h=60&fit=crop&crop=face&auto=format',
            month: 'October',
            year: '2024',
            status: 'approved',
            score: 90,
            rank: 2,
            department: 'Sales'
        },
        {
            id: '11',
            name: 'Kevin Lee',
            profileImage: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=60&h=60&fit=crop&crop=face&auto=format',
            month: 'October',
            year: '2024',
            status: 'submitted',
            score: 87,
            rank: 3,
            department: 'Sales'
        },

        // HR Department
        {
            id: '12',
            name: 'Rachel Thompson',
            profileImage: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=60&h=60&fit=crop&crop=face&auto=format',
            month: 'October',
            year: '2024',
            status: 'approved',
            score: 92,
            rank: 1,
            department: 'HR'
        },
        {
            id: '13',
            name: 'Daniel Kim',
            profileImage: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=60&h=60&fit=crop&crop=face&auto=format',
            month: 'October',
            year: '2024',
            status: 'pending',
            score: 86,
            rank: 2,
            department: 'HR'
        },

        // Finance Department
        {
            id: '14',
            name: 'Jennifer White',
            profileImage: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=60&h=60&fit=crop&crop=face&auto=format',
            month: 'October',
            year: '2024',
            status: 'approved',
            score: 94,
            rank: 1,
            department: 'Finance'
        },
        {
            id: '15',
            name: 'Thomas Anderson',
            profileImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=60&h=60&fit=crop&crop=face&auto=format',
            month: 'October',
            year: '2024',
            status: 'submitted',
            score: 89,
            rank: 2,
            department: 'Finance'
        },
        {
            id: '16',
            name: 'Michelle Davis',
            profileImage: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=60&h=60&fit=crop&crop=face&auto=format',
            month: 'October',
            year: '2024',
            status: 'approved',
            score: 87,
            rank: 3,
            department: 'Finance'
        },

        // Operations Department
        {
            id: '17',
            name: 'Christopher Moore',
            profileImage: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=60&h=60&fit=crop&crop=face&auto=format',
            month: 'October',
            year: '2024',
            status: 'approved',
            score: 91,
            rank: 1,
            department: 'Operations'
        },
        {
            id: '18',
            name: 'Ashley Johnson',
            profileImage: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=60&h=60&fit=crop&crop=face&auto=format',
            month: 'October',
            year: '2024',
            status: 'submitted',
            score: 88,
            rank: 2,
            department: 'Operations'
        },
        {
            id: '19',
            name: 'Matthew Wilson',
            profileImage: 'https://images.unsplash.com/photo-1519244703995-f4e0f30006d5?w=60&h=60&fit=crop&crop=face&auto=format',
            month: 'October',
            year: '2024',
            status: 'pending',
            score: 85,
            rank: 3,
            department: 'Operations'
        }
    ];

    constructor() { }

    ngOnInit() {
        console.log('CED Dashboard initialized');
        console.log('Current view:', this.currentView);
        console.log('Departments:', this.departments);
        console.log('Departments length:', this.departments.length);

        // Ensure we have data
        if (this.departments.length === 0) {
            console.warn('No departments data found!');
        }
    }

    ngAfterViewInit() {
        // Cards are now visible immediately without animations
        console.log('Dashboard loaded successfully');
    }

    ngOnDestroy() {
        // Cleanup any subscriptions or intervals
    }

    onMonthYearChange() {
        // Filter data based on selected month and year
        console.log(`Filtering data for ${this.selectedMonth} ${this.selectedYear}`);
        // Implement filtering logic here
    }

    selectDepartment(department: Department) {
        console.log('Selecting department:', department.name);
        this.selectedDepartment = department;
        this.currentView = 'employees';
        this.searchQuery = ''; // Reset search when switching departments
        this.filteredEmployees = []; // Clear filtered results

        // Log available employees for this department
        const deptEmployees = this.employees.filter(emp => emp.department === department.name);
        console.log(`Found ${deptEmployees.length} employees in ${department.name}:`, deptEmployees);
    }

    backToDepartments() {
        this.currentView = 'departments';
        this.selectedDepartment = null;
        this.searchQuery = '';
        this.filteredEmployees = [];
    }

    getRankIcon(rank: number): string {
        switch (rank) {
            case 1: return '🥇';
            case 2: return '🥈';
            case 3: return '🥉';
            default: return `#${rank}`;
        }
    }

    getStatusClass(status: string): string {
        switch (status) {
            case 'approved': return 'status-approved';
            case 'submitted': return 'status-submitted';
            case 'pending': return 'status-pending';
            default: return '';
        }
    }

    getStatusText(status: string): string {
        switch (status) {
            case 'approved': return 'Approved';
            case 'submitted': return 'Submitted';
            case 'pending': return 'Pending';
            default: return status;
        }
    }

    viewEmployeeProfile(employee: Employee) {
        console.log('Viewing profile for:', employee.name);
        // Implement profile view navigation
    }

    viewMPRDetails(employee: Employee) {
        console.log('Viewing MPR details for:', employee.name);
        // Implement MPR details navigation
    }

    getCompletionPercentage(department: Department): number {
        return Math.round((department.approvedMPR / department.totalEmployees) * 100);
    }

    onSearchChange() {
        if (!this.searchQuery.trim()) {
            // If search is empty, show all employees from selected department
            this.filteredEmployees = this.employees.filter(emp =>
                emp.department === this.selectedDepartment?.name
            );
        } else {
            // Filter by search query within the selected department
            this.filteredEmployees = this.employees.filter(emp =>
                emp.department === this.selectedDepartment?.name &&
                emp.name.toLowerCase().includes(this.searchQuery.toLowerCase())
            );
        }
    }

    getDisplayedEmployees(): Employee[] {
        if (!this.selectedDepartment) {
            return [];
        }

        // If we have a search query, return filtered results (even if empty)
        if (this.searchQuery.trim()) {
            return this.filteredEmployees;
        }

        // Otherwise return all employees from the selected department
        return this.employees.filter(emp => emp.department === this.selectedDepartment?.name);
    }

    getStatIcon(statType: string): string {
        const iconMap: { [key: string]: string } = {
            'totalEmployees': 'fas fa-users',
            'submittedMPR': 'fas fa-upload',
            'pendingMPR': 'fas fa-clock',
            'approvedMPR': 'fas fa-check-circle'
        };
        console.log(`Getting icon for ${statType}:`, iconMap[statType]);
        return iconMap[statType] || 'fas fa-chart-bar';
    }

    // TrackBy functions for performance optimization
    trackByDepartmentId(_index: number, department: Department): string {
        return department.id;
    }

    trackByEmployeeId(_index: number, employee: Employee): string {
        return employee.id;
    }
}
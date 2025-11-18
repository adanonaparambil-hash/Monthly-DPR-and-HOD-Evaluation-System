import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Api } from '../services/api';
import { EmployeeProfileModalComponent } from '../employee-profile-modal/employee-profile-modal.component';

interface Department {
    department: string;
    totalEmployees: number;
    submittedMPR: number;
    pendingMPR: number;
    approvedMPR: number;
    color?: string;
    icon?: string;
}

interface ApiResponse {
    success: boolean;
    message: string;
    data: Department[];
}

interface PerformanceMetrics {
    quality: number;
    timeliness: number;
    initiative: number;
    communication: number;
    teamwork: number;
    problemSolving: number;
    hodRating: number;
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
    dprId?: number;
    performanceMetrics?: PerformanceMetrics;
}

interface ApiEmployee {
    empID: string;
    employeeName: string;
    approvalStatus: string;
    overAllScore: number;
    scoreQuality: number;
    timeliness: number;
    initiative: number;
    communication: number;
    hOdRating: number;
    problemSolving: number;
    teamwork: number;
    dprId: number;
    profileImage: string | null;
    profileImageBase64: string;
}

@Component({
    selector: 'app-ced-dashboard-new',
    standalone: true,
    imports: [CommonModule, FormsModule, EmployeeProfileModalComponent],
    templateUrl: './ced-dashboard-new.component.html',
    styleUrls: ['./ced-dashboard-new.component.css']
})
export class CedDashboardNewComponent implements OnInit, AfterViewInit, OnDestroy {
    selectedMonth: number = 0;
    selectedYear: number = 0;
    currentView: 'departments' | 'employees' = 'departments';
    selectedDepartment: Department | null = null;
    searchQuery: string = '';
    filteredEmployees: Employee[] = [];
    expandedEmployeeId: string | null = null;
    isLoading: boolean = false;
    selectedStatusFilter: string = 'T';
    showProfileModal: boolean = false;
    selectedEmployeeId: string = '';
    selectedEmployeeProfile: Employee | null = null;
    apiEmployees: ApiEmployee[] = []; // Store API response employees

    months = [
        { value: 1, name: 'January' },
        { value: 2, name: 'February' },
        { value: 3, name: 'March' },
        { value: 4, name: 'April' },
        { value: 5, name: 'May' },
        { value: 6, name: 'June' },
        { value: 7, name: 'July' },
        { value: 8, name: 'August' },
        { value: 9, name: 'September' },
        { value: 10, name: 'October' },
        { value: 11, name: 'November' },
        { value: 12, name: 'December' }
    ];

    years = [2025, 2024, 2023, 2022];

    // Status filter options with API flags
    statusFilters = [
        { value: 'T', label: 'Total Employees', icon: 'fas fa-users' },
        { value: 'A', label: 'Approved', icon: 'fas fa-check-circle' },
        { value: 'S', label: 'Submitted', icon: 'fas fa-upload' },
        { value: 'P', label: 'Pending', icon: 'fas fa-clock' }
    ];

    departments: Department[] = [];

    // Department icons mapping
    departmentIcons: { [key: string]: string } = {
        'QS PRE TENDER': 'fas fa-clipboard-list',
        'FINANCE': 'fas fa-calculator',
        'CONTRACTS': 'fas fa-file-contract',
        'PLANNING': 'fas fa-project-diagram',
        'ADMINISTRATION': 'fas fa-building',
        'CWS': 'fas fa-water',
        'FMT': 'fas fa-tools',
        'AFW': 'fas fa-shield-alt',
        'POST TENSION': 'fas fa-compress-arrows-alt',
        'ADMINISTRATION & GENERAL': 'fas fa-cogs',
        'PROJECTS': 'fas fa-tasks',
        'PURCHASE': 'fas fa-shopping-cart',
        'HUMAN RESOURCES': 'fas fa-users',
        'DESIGN & BUILD': 'fas fa-drafting-compass',
        'HSE': 'fas fa-hard-hat',
        'QS POST TENDER': 'fas fa-clipboard-check',
        'PMV': 'fas fa-car',
        'OPERATIONS': 'fas fa-cogs',
        'IT': 'fas fa-laptop-code',
        'QUALITY ASSURANCE & QUALITY CONTROL': 'fas fa-check-double',
        'CAD': 'fas fa-draw-polygon',
        'STORES': 'fas fa-warehouse',
        'TRAINING, WELFARE & DEVELOPMENT': 'fas fa-graduation-cap',
        'AUDIT': 'fas fa-search'
    };

    // Department colors mapping
    departmentColors: { [key: string]: string } = {
        'QS PRE TENDER': 'dept-qs-pre',
        'FINANCE': 'dept-finance',
        'CONTRACTS': 'dept-contracts',
        'PLANNING': 'dept-planning',
        'ADMINISTRATION': 'dept-admin',
        'CWS': 'dept-cws',
        'FMT': 'dept-fmt',
        'AFW': 'dept-afw',
        'POST TENSION': 'dept-post-tension',
        'ADMINISTRATION & GENERAL': 'dept-admin-general',
        'PROJECTS': 'dept-projects',
        'PURCHASE': 'dept-purchase',
        'HUMAN RESOURCES': 'dept-hr',
        'DESIGN & BUILD': 'dept-design',
        'HSE': 'dept-hse',
        'QS POST TENDER': 'dept-qs-post',
        'PMV': 'dept-pmv',
        'OPERATIONS': 'dept-operations',
        'IT': 'dept-it',
        'QUALITY ASSURANCE & QUALITY CONTROL': 'dept-qa-qc',
        'CAD': 'dept-cad',
        'STORES': 'dept-stores',
        'TRAINING, WELFARE & DEVELOPMENT': 'dept-training',
        'AUDIT': 'dept-audit'
    };

    // Icons for different stats
    statIcons = {
        totalEmployees: 'fas fa-users',
        submittedMPR: 'fas fa-upload',
        pendingMPR: 'fas fa-clock',
        approvedMPR: 'fas fa-check-circle'
    };

    employees: Employee[] = [
        // IT Department (matches API)
        {
            id: '1',
            name: 'Sarah Johnson',
            profileImage: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=60&h=60&fit=crop&crop=face&auto=format',
            month: 'October',
            year: '2024',
            status: 'approved',
            score: 96,
            rank: 1,
            department: 'IT',
            performanceMetrics: {
                quality: 96,
                timeliness: 94,
                initiative: 98,
                communication: 95,
                teamwork: 93,
                problemSolving: 97,
                hodRating: 95
            }
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
            department: 'IT',
            performanceMetrics: {
                quality: 92,
                timeliness: 96,
                initiative: 90,
                communication: 94,
                teamwork: 95,
                problemSolving: 93,
                hodRating: 94
            }
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
            department: 'IT',
            performanceMetrics: {
                quality: 90,
                timeliness: 92,
                initiative: 94,
                communication: 91,
                teamwork: 89,
                problemSolving: 95,
                hodRating: 92
            }
        },

        // FINANCE Department (matches API)
        {
            id: '4',
            name: 'Jessica Martinez',
            profileImage: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60&h=60&fit=crop&crop=face&auto=format',
            month: 'October',
            year: '2024',
            status: 'approved',
            score: 95,
            rank: 1,
            department: 'FINANCE',
            performanceMetrics: {
                quality: 94,
                timeliness: 96,
                initiative: 95,
                communication: 97,
                teamwork: 93,
                problemSolving: 94,
                hodRating: 95
            }
        },
        {
            id: '5',
            name: 'David Wilson',
            profileImage: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=60&h=60&fit=crop&crop=face&auto=format',
            month: 'October',
            year: '2024',
            status: 'submitted',
            score: 88,
            rank: 2,
            department: 'FINANCE',
            performanceMetrics: {
                quality: 86,
                timeliness: 90,
                initiative: 88,
                communication: 89,
                teamwork: 87,
                problemSolving: 88,
                hodRating: 88
            }
        },
        {
            id: '6',
            name: 'Amanda Brown',
            profileImage: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=60&h=60&fit=crop&crop=face&auto=format',
            month: 'October',
            year: '2024',
            status: 'pending',
            score: 85,
            rank: 3,
            department: 'FINANCE',
            performanceMetrics: {
                quality: 83,
                timeliness: 87,
                initiative: 85,
                communication: 86,
                teamwork: 84,
                problemSolving: 85,
                hodRating: 85
            }
        },

        // PROJECTS Department (matches API)
        {
            id: '7',
            name: 'James Rodriguez',
            profileImage: 'https://images.unsplash.com/photo-1519244703995-f4e0f30006d5?w=60&h=60&fit=crop&crop=face&auto=format',
            month: 'October',
            year: '2024',
            status: 'approved',
            score: 93,
            rank: 1,
            department: 'PROJECTS'
        },
        {
            id: '8',
            name: 'Maria Garcia',
            profileImage: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=60&h=60&fit=crop&crop=face&auto=format',
            month: 'October',
            year: '2024',
            status: 'approved',
            score: 90,
            rank: 2,
            department: 'PROJECTS'
        },
        {
            id: '9',
            name: 'Kevin Lee',
            profileImage: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=60&h=60&fit=crop&crop=face&auto=format',
            month: 'October',
            year: '2024',
            status: 'submitted',
            score: 87,
            rank: 3,
            department: 'PROJECTS'
        },
        {
            id: '10',
            name: 'Lisa Chen',
            profileImage: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=60&h=60&fit=crop&crop=face&auto=format',
            month: 'October',
            year: '2024',
            status: 'pending',
            score: 84,
            rank: 4,
            department: 'PROJECTS'
        },
        {
            id: '11',
            name: 'Robert Kim',
            profileImage: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=60&h=60&fit=crop&crop=face&auto=format',
            month: 'October',
            year: '2024',
            status: 'submitted',
            score: 82,
            rank: 5,
            department: 'PROJECTS'
        },

        // HUMAN RESOURCES Department (matches API)
        {
            id: '12',
            name: 'Rachel Thompson',
            profileImage: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=60&h=60&fit=crop&crop=face&auto=format',
            month: 'October',
            year: '2024',
            status: 'approved',
            score: 92,
            rank: 1,
            department: 'HUMAN RESOURCES'
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
            department: 'HUMAN RESOURCES'
        },

        // OPERATIONS Department (matches API)
        {
            id: '14',
            name: 'Jennifer White',
            profileImage: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=60&h=60&fit=crop&crop=face&auto=format',
            month: 'October',
            year: '2024',
            status: 'approved',
            score: 94,
            rank: 1,
            department: 'OPERATIONS'
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
            department: 'OPERATIONS'
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
            department: 'OPERATIONS'
        },

        // ADMINISTRATION Department (matches API)
        {
            id: '17',
            name: 'Christopher Moore',
            profileImage: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=60&h=60&fit=crop&crop=face&auto=format',
            month: 'October',
            year: '2024',
            status: 'approved',
            score: 91,
            rank: 1,
            department: 'ADMINISTRATION'
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
            department: 'ADMINISTRATION'
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
            department: 'ADMINISTRATION'
        },

        // PLANNING Department (matches API)
        {
            id: '20',
            name: 'Sarah Williams',
            profileImage: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60&h=60&fit=crop&crop=face&auto=format',
            month: 'October',
            year: '2024',
            status: 'approved',
            score: 89,
            rank: 1,
            department: 'PLANNING'
        },
        {
            id: '21',
            name: 'John Martinez',
            profileImage: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=60&h=60&fit=crop&crop=face&auto=format',
            month: 'October',
            year: '2024',
            status: 'submitted',
            score: 86,
            rank: 2,
            department: 'PLANNING'
        },

        // HSE Department (matches API)
        {
            id: '22',
            name: 'Emma Thompson',
            profileImage: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=60&h=60&fit=crop&crop=face&auto=format',
            month: 'October',
            year: '2024',
            status: 'approved',
            score: 92,
            rank: 1,
            department: 'HSE'
        },
        {
            id: '23',
            name: 'Alex Brown',
            profileImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=60&h=60&fit=crop&crop=face&auto=format',
            month: 'October',
            year: '2024',
            status: 'pending',
            score: 88,
            rank: 2,
            department: 'HSE'
        }
    ];

    constructor(private apiService: Api, private router: Router) { }

    ngOnInit() {
        console.log('CED Dashboard initialized');
        this.initializeDefaultMonthYear();
        this.loadDashboardData();
        
        // Debug: Log initial values
        console.log('Initial selectedMonth:', this.selectedMonth);
        console.log('Initial selectedYear:', this.selectedYear);
        console.log('Months array:', this.months);
        console.log('Years array:', this.years);
    }

    private initializeDefaultMonthYear() {
        const currentDate = new Date();
        // Set to previous month by default
        const previousMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1);

        this.selectedMonth = previousMonth.getMonth() + 1; // getMonth() returns 0-11, we need 1-12
        this.selectedYear = previousMonth.getFullYear();

        console.log(`Default selection: Month ${this.selectedMonth}, Year ${this.selectedYear}`);
    }

    private loadDashboardData() {
        if (this.selectedMonth === 0 || this.selectedYear === 0) {
            console.warn('Month or Year not selected');
            return;
        }

        this.isLoading = true;
        console.log(`Loading dashboard data for month: ${this.selectedMonth}, year: ${this.selectedYear}`);

        this.apiService.GetCEDDepartmentWiseDashBoardDetails(this.selectedMonth, this.selectedYear)
            .subscribe({
                next: (response: ApiResponse) => {
                    console.log('API Response:', response);
                    if (response.success && response.data) {
                        this.departments = response.data.map(dept => ({
                            ...dept,
                            icon: this.departmentIcons[dept.department] || 'fas fa-building',
                            color: this.departmentColors[dept.department] || 'dept-default'
                        }));
                        console.log('Departments loaded:', this.departments);
                    } else {
                        console.error('Failed to load dashboard data:', response.message);
                        this.departments = [];
                    }
                    this.isLoading = false;
                },
                error: (error) => {
                    console.error('Error loading dashboard data:', error);
                    this.departments = [];
                    this.isLoading = false;
                }
            });
    }

    ngAfterViewInit() {
        // Cards are now visible immediately without animations
        console.log('Dashboard loaded successfully');
    }

    ngOnDestroy() {
        // Cleanup any subscriptions or intervals
    }

    onMonthYearChange() {
        console.log(`Month/Year changed to: ${this.selectedMonth}/${this.selectedYear}`);
        console.log('Month/Year change triggered - loading new data...');
        this.loadDashboardData();

        // Reset current view to departments when filter changes
        if (this.currentView === 'employees') {
            this.backToDepartments();
        }
    }

    selectDepartment(department: Department) {
        console.log('Selecting department:', department.department);
        this.selectedDepartment = department;
        this.currentView = 'employees';
        this.searchQuery = ''; // Reset search when switching departments
        this.filteredEmployees = []; // Clear filtered results
        this.selectedStatusFilter = 'T'; // Default to Total Employees
        this.expandedEmployeeId = null; // Reset expanded state

        // Load employees for this department with default status
        this.loadEmployeesForDepartment();
    }

    backToDepartments() {
        this.currentView = 'departments';
        this.selectedDepartment = null;
        this.searchQuery = '';
        this.filteredEmployees = [];
        this.selectedStatusFilter = 'approved';
        this.expandedEmployeeId = null;
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
        console.log('Viewing profile for:', employee.name, 'ID:', employee.id);
        this.selectedEmployeeId = employee.id;
        this.selectedEmployeeProfile = employee;
        this.showProfileModal = true;
    }

    closeProfileModal() {
        this.showProfileModal = false;
        this.selectedEmployeeId = '';
        this.selectedEmployeeProfile = null;
    }

    viewMPRDetails(employee: Employee) {
        console.log('Viewing MPR details for:', employee.name, 'DPR ID:', employee.dprId);
        
        if (employee.dprId) {
            this.router.navigate(['/monthly-dpr', employee.dprId], { 
                queryParams: { 
                    readonly: '1',
                    from: 'ced-dashboard' 
                }
            });
        } else {
            console.warn('No DPR ID found for employee:', employee.name);
        }
    }

    getCompletionPercentage(department: Department): number {
        return Math.round((department.approvedMPR / department.totalEmployees) * 100);
    }

    getDepartmentIconColor(departmentName: string): string {
        const colorMap: { [key: string]: string } = {
            'IT': '#3b82f6',           // Blue
            'HR': '#10b981',           // Green  
            'Finance': '#f59e0b',      // Amber
            'Marketing': '#ef4444',    // Red
            'Sales': '#8b5cf6',        // Purple
            'Operations': '#06b6d4',   // Cyan
            'Engineering': '#f97316',  // Orange
            'Legal': '#6366f1',        // Indigo
            'Admin': '#84cc16',        // Lime
            'Support': '#ec4899',      // Pink
            'Quality': '#14b8a6',      // Teal
            'Research': '#a855f7'      // Violet
        };
        
        return colorMap[departmentName] || '#6b7280'; // Default gray if department not found
    }

    onSearchChange() {
        if (!this.searchQuery.trim()) {
            // If search is empty, show all employees from selected department
            this.filteredEmployees = this.employees.filter(emp =>
                emp.department === this.selectedDepartment?.department
            );
        } else {
            // Filter by search query within the selected department
            this.filteredEmployees = this.employees.filter(emp =>
                emp.department === this.selectedDepartment?.department &&
                emp.name.toLowerCase().includes(this.searchQuery.toLowerCase())
            );
        }
    }

    getDisplayedEmployees(): Employee[] {
        if (!this.selectedDepartment || !this.apiEmployees) {
            return [];
        }

        // Convert API employees to display format
        let employees = this.apiEmployees.map((apiEmp, index) => ({
            id: apiEmp.empID,
            name: apiEmp.employeeName,
            profileImage: apiEmp.profileImageBase64 || 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=60&h=60&fit=crop&crop=face&auto=format',
            month: this.getMonthName(this.selectedMonth),
            year: this.selectedYear.toString(),
            status: this.mapApprovalStatusToDisplayStatus(apiEmp.approvalStatus),
            score: apiEmp.overAllScore || 0,
            rank: index + 1, // Assign rank based on order from API
            department: this.selectedDepartment?.department || '',
            dprId: apiEmp.dprId, // Include DPR ID for navigation
            performanceMetrics: {
                quality: apiEmp.scoreQuality || 0,
                timeliness: apiEmp.timeliness || 0,
                initiative: apiEmp.initiative || 0,
                communication: apiEmp.communication || 0,
                teamwork: apiEmp.teamwork || 0,
                problemSolving: apiEmp.problemSolving || 0,
                hodRating: apiEmp.hOdRating || 0
            }
        }));

        // Apply search filter if exists
        if (this.searchQuery.trim()) {
            employees = employees.filter(emp => 
                emp.name.toLowerCase().includes(this.searchQuery.toLowerCase())
            );
        }

        // Sort by overall score (highest first)
        return employees.sort((a, b) => b.score - a.score);
    }

    private mapApprovalStatusToDisplayStatus(approvalStatus: string): 'submitted' | 'pending' | 'approved' {
        switch (approvalStatus) {
            case 'A': return 'approved';
            case 'S': return 'submitted';
            case 'P': return 'pending';
            default: return 'pending';
        }
    }

    onStatusFilterChange() {
        console.log('Status filter changed to:', this.selectedStatusFilter);
        this.searchQuery = ''; // Reset search when changing status
        this.expandedEmployeeId = null; // Reset expanded state
        
        // Load employees with new status filter
        this.loadEmployeesForDepartment();
    }

    private loadEmployeesForDepartment() {
        if (!this.selectedDepartment || this.selectedMonth === 0 || this.selectedYear === 0) {
            console.warn('Department, month, or year not selected');
            return;
        }

        this.isLoading = true;
        console.log(`Loading employees for department: ${this.selectedDepartment.department}, status: ${this.selectedStatusFilter}, month: ${this.selectedMonth}, year: ${this.selectedYear}`);

        this.apiService.GetEmployeeDetailsForcedDashboard(
            this.selectedMonth, 
            this.selectedYear, 
            this.selectedStatusFilter, 
            this.selectedDepartment.department
        ).subscribe({
            next: (response: { success: boolean; message: string; data: ApiEmployee[] }) => {
                console.log('Employee API Response:', response);
                if (response.success && response.data) {
                    this.apiEmployees = response.data;
                    console.log('Employees loaded:', this.apiEmployees);
                    
                    // Scroll to top of the employee list after loading
                    setTimeout(() => {
                        const employeeListContainer = document.querySelector('.employees-container');
                        if (employeeListContainer) {
                            employeeListContainer.scrollTo({ top: 0, behavior: 'smooth' });
                        }
                    }, 100);
                } else {
                    console.error('Failed to load employee data:', response.message);
                    this.apiEmployees = [];
                }
                this.isLoading = false;
            },
            error: (error) => {
                console.error('Error loading employee data:', error);
                this.apiEmployees = [];
                this.isLoading = false;
            }
        });
    }

    canExpandEmployee(employee: Employee): boolean {
        return employee.status === 'approved';
    }

    getEmployeeCountByStatus(status: string): number {
        if (!this.selectedDepartment) return 0;
        
        // Use department data from the dashboard API for counts
        switch (status) {
            case 'T': return this.selectedDepartment.totalEmployees;
            case 'A': return this.selectedDepartment.approvedMPR;
            case 'S': return this.selectedDepartment.submittedMPR;
            case 'P': return this.selectedDepartment.pendingMPR;
            default: return 0;
        }
    }

    getDisplayScore(employee: Employee): number {
        // Only approved employees show their actual score, others show 0
        return employee.status === 'approved' ? employee.score : 0;
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
        return department.department;
    }

    // Get month name from number
    getMonthName(monthNumber: number): string {
        const month = this.months.find(m => m.value === monthNumber);
        return month ? month.name : '';
    }

    trackByEmployeeId(_index: number, employee: Employee): string {
        return employee.id;
    }

    // Toggle employee details expansion (only for approved employees)
    toggleEmployeeDetails(employeeId: string, employee: Employee) {
        if (!this.canExpandEmployee(employee)) {
            return; // Don't expand if not approved
        }
        this.expandedEmployeeId = this.expandedEmployeeId === employeeId ? null : employeeId;
    }

    // Check if employee details are expanded
    isEmployeeExpanded(employeeId: string): boolean {
        return this.expandedEmployeeId === employeeId;
    }

    // Get performance metric icon
    getPerformanceMetricIcon(metricType: string): string {
        const iconMap: { [key: string]: string } = {
            'quality': 'fas fa-star',
            'timeliness': 'fas fa-clock',
            'initiative': 'fas fa-lightbulb',
            'communication': 'fas fa-comments',
            'teamwork': 'fas fa-users',
            'problemSolving': 'fas fa-puzzle-piece',
            'hodRating': 'fas fa-award'
        };
        return iconMap[metricType] || 'fas fa-chart-bar';
    }

    // Get performance metric color based on score
    getPerformanceMetricColor(score: number): string {
        if (score >= 90) return '#10b981'; // Green
        if (score >= 80) return '#f59e0b'; // Orange
        if (score >= 70) return '#ef4444'; // Red
        return '#6b7280'; // Gray
    }

    // Get rank icon for top performers
    getRankIconClass(rank: number): string {
        switch (rank) {
            case 1: return 'rank-gold';
            case 2: return 'rank-silver';
            case 3: return 'rank-bronze';
            default: return 'rank-default';
        }
    }
}
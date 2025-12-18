import { Injectable } from '@angular/core';
import { ApprovalStep, DepartmentApproval, EmployeeExitRequest } from '../models/employeeExit.model';

@Injectable({
  providedIn: 'root'
})
export class ApprovalWorkflowService {

  constructor() { }

  
  generateApprovalWorkflow(formType: 'E' | 'P' | 'R', formData: any): ApprovalStep[] {
    const workflow: ApprovalStep[] = [];
    let stepOrder = 1;

    switch (formType) {
      case 'E': // Emergency Exit
        workflow.push(...this.getEmergencyApprovalSteps(formData, stepOrder));
        break;
      
      case 'P': // Planned Leave
        workflow.push(...this.getPlannedLeaveApprovalSteps(formData, stepOrder));
        break;
      
      case 'R': // Resignation
        workflow.push(...this.getResignationApprovalSteps(formData, stepOrder));
        break;
    }

    return workflow;
  }

  /**
   * Emergency Exit Approval Flow:
   * 1. Responsible Persons (multiple) -> 2. HOD -> 3. Department Approvals (IT, Finance, etc.) -> 4. Admin
   */
  private getEmergencyApprovalSteps(formData: any, startOrder: number): ApprovalStep[] {
    const steps: ApprovalStep[] = [];
    let order = startOrder;

    // Step 1: Responsible Persons Approval (Multiple people can approve)
    if (formData.responsibilities && formData.responsibilities.length > 0) {
      const responsiblePersonIds = formData.responsibilities.map((r: any) => r.rpersonEmpId || r.responsiblePersonId);
      const responsiblePersonNames = formData.responsibilities.map((r: any) => r.responsiblePersonName);
      
      steps.push({
        stepId: order++,
        stepName: 'Responsible Person Approval',
        approverType: 'RESPONSIBLE_PERSON',
        approverIds: responsiblePersonIds,
        approverNames: responsiblePersonNames,
        status: 'PENDING',
        isRequired: true,
        order: order - 1
      });
    }

    // Step 2: HOD Approval
    steps.push({
      stepId: order++,
      stepName: 'HOD Approval',
      approverType: 'HOD',
      approverIds: [formData.depHod || formData.hodName],
      approverNames: [formData.hodName || 'HOD'],
      status: 'PENDING',
      isRequired: true,
      order: order - 1
    });

    // Step 3: Department Approvals (IT, Finance, HR, etc.)
    const departments = ['IT', 'Finance', 'Facility Management/Transport', 'HR'];
    departments.forEach(dept => {
      steps.push({
        stepId: order++,
        stepName: `${dept} Department Approval`,
        approverType: 'DEPARTMENT',
        approverIds: [dept.toLowerCase().replace(/[^a-z]/g, '')],
        approverNames: [dept],
        status: 'PENDING',
        isRequired: true,
        order: order - 1
      });
    });

    // Step 4: Admin Final Approval
    steps.push({
      stepId: order++,
      stepName: 'Admin Final Approval',
      approverType: 'DEPARTMENT',
      approverIds: ['admin'],
      approverNames: ['Admin'],
      status: 'PENDING',
      isRequired: true,
      order: order - 1
    });

    return steps;
  }

  /**
   * Planned Leave Approval Flow:
   * 1. Responsibilities Handed Over To -> 2. Project Manager/Site Incharge -> 3. HOD -> 4. Department Approvals -> 5. Admin
   */
  private getPlannedLeaveApprovalSteps(formData: any, startOrder: number): ApprovalStep[] {
    const steps: ApprovalStep[] = [];
    let order = startOrder;

    // Step 1: Responsibilities Handed Over To Approval
    if (formData.responsibilitiesHandedOverToId || formData.responsibilitiesHandedOverTo) {
      steps.push({
        stepId: order++,
        stepName: 'Responsibilities Handover Approval',
        approverType: 'RESPONSIBLE_PERSON',
        approverIds: [formData.responsibilitiesHandedOverToId || formData.responsibilitiesHandedOverTo],
        approverNames: [formData.responsibilitiesHandedOverTo || 'Responsible Person'],
        status: 'PENDING',
        isRequired: true,
        order: order - 1
      });
    }

    // Step 2: Project Manager / Site Incharge Approval
    if (formData.projectSiteIncharge || formData.projectManagerName) {
      steps.push({
        stepId: order++,
        stepName: 'Project Manager / Site Incharge Approval',
        approverType: 'PROJECT_MANAGER',
        approverIds: [formData.projectSiteIncharge || formData.projectManagerName],
        approverNames: [formData.projectManagerName || 'Project Manager'],
        status: 'PENDING',
        isRequired: true,
        order: order - 1
      });
    }

    // Step 3: HOD Approval (if different from Project Manager)
    const hodId = formData.depHod || formData.hodName;
    const pmId = formData.projectSiteIncharge || formData.projectManagerName;
    
    if (hodId && hodId !== pmId) {
      steps.push({
        stepId: order++,
        stepName: 'HOD Approval',
        approverType: 'HOD',
        approverIds: [hodId],
        approverNames: [formData.hodName || 'HOD'],
        status: 'PENDING',
        isRequired: true,
        order: order - 1
      });
    }

    // Step 4: Department Approvals
    const departments = ['IT', 'Finance', 'Facility Management/Transport', 'HR'];
    departments.forEach(dept => {
      steps.push({
        stepId: order++,
        stepName: `${dept} Department Approval`,
        approverType: 'DEPARTMENT',
        approverIds: [dept.toLowerCase().replace(/[^a-z]/g, '')],
        approverNames: [dept],
        status: 'PENDING',
        isRequired: true,
        order: order - 1
      });
    });

    // Step 5: Admin Final Approval
    steps.push({
      stepId: order++,
      stepName: 'Admin Final Approval',
      approverType: 'DEPARTMENT',
      approverIds: ['admin'],
      approverNames: ['Admin'],
      status: 'PENDING',
      isRequired: true,
      order: order - 1
    });

    return steps;
  }

  /**
   * Resignation Approval Flow: Same as Planned Leave
   */
  private getResignationApprovalSteps(formData: any, startOrder: number): ApprovalStep[] {
    return this.getPlannedLeaveApprovalSteps(formData, startOrder);
  }

  /**
   * Generate department approval structure
   */
  generateDepartmentApprovals(): DepartmentApproval[] {
    return [
      {
        departmentId: 'cwh',
        departmentName: 'CWH',
        status: 'PENDING',
        items: [
          { itemName: 'Staff-CWH', itemType: 'checkbox', isCleared: false },
          { itemName: 'Worker-Site/CWH', itemType: 'checkbox', isCleared: false },
          { itemName: 'Tool Box Kit', itemType: 'text', isCleared: false },
          { itemName: 'Liabilities if any', itemType: 'text', isCleared: false }
        ]
      },
      {
        departmentId: 'it',
        departmentName: 'IT',
        status: 'PENDING',
        items: [
          { itemName: 'Mobile Phone', itemType: 'checkbox', isCleared: false },
          { itemName: 'Desktop', itemType: 'checkbox', isCleared: false },
          { itemName: 'Laptop', itemType: 'checkbox', isCleared: false },
          { itemName: 'Tab', itemType: 'checkbox', isCleared: false },
          { itemName: 'Liabilities if any', itemType: 'text', isCleared: false }
        ]
      },
      {
        departmentId: 'finance',
        departmentName: 'Finance',
        status: 'PENDING',
        items: [
          { itemName: 'Petty Cash', itemType: 'number', isCleared: false },
          { itemName: 'Bank Liabilities', itemType: 'text', isCleared: false },
          { itemName: 'Liabilities if any', itemType: 'text', isCleared: false }
        ]
      },
      {
        departmentId: 'facility',
        departmentName: 'Facility Management/Transport',
        status: 'PENDING',
        items: [
          { itemName: 'Accommodation Key', itemType: 'checkbox', isCleared: false },
          { itemName: 'Company Car', itemType: 'checkbox', isCleared: false },
          { itemName: 'Make/Model', itemType: 'text', isCleared: false },
          { itemName: 'Car Km', itemType: 'number', isCleared: false },
          { itemName: 'Liabilities if any', itemType: 'text', isCleared: false }
        ]
      },
      {
        departmentId: 'hr',
        departmentName: 'HR',
        status: 'PENDING',
        items: [
          { itemName: 'Medical Claims', itemType: 'text', isCleared: false },
          { itemName: 'Ticket', itemType: 'checkbox', isCleared: false },
          { itemName: 'Passport', itemType: 'checkbox', isCleared: false },
          { itemName: 'Punching Card', itemType: 'checkbox', isCleared: false },
          { itemName: 'Liabilities if any', itemType: 'text', isCleared: false }
        ]
      },
      {
        departmentId: 'admin',
        departmentName: 'Admin',
        status: 'PENDING',
        items: [
          { itemName: 'Sim Card', itemType: 'checkbox', isCleared: false },
          { itemName: 'Telephone Charges', itemType: 'number', isCleared: false },
          { itemName: 'Leave Settlement', itemType: 'text', isCleared: false },
          { itemName: 'Final Settlement', itemType: 'text', isCleared: false },
          { itemName: 'Liabilities if any', itemType: 'text', isCleared: false }
        ]
      }
    ];
  }

  /**
   * Get current active approval step
   */
  getCurrentApprovalStep(workflow: ApprovalStep[]): ApprovalStep | null {
    return workflow.find(step => step.status === 'PENDING') || null;
  }

  /**
   * Get next approval step after current one is approved
   */
  getNextApprovalStep(workflow: ApprovalStep[], currentStepId: number): ApprovalStep | null {
    const currentIndex = workflow.findIndex(step => step.stepId === currentStepId);
    if (currentIndex >= 0 && currentIndex < workflow.length - 1) {
      return workflow[currentIndex + 1];
    }
    return null;
  }

  /**
   * Check if all required steps are approved
   */
  isWorkflowComplete(workflow: ApprovalStep[]): boolean {
    return workflow.every(step => !step.isRequired || step.status === 'APPROVED');
  }

  /**
   * Check if workflow is rejected
   */
  isWorkflowRejected(workflow: ApprovalStep[]): boolean {
    return workflow.some(step => step.status === 'REJECTED');
  }

  /**
   * Get workflow progress percentage
   */
  getWorkflowProgress(workflow: ApprovalStep[]): number {
    const totalSteps = workflow.filter(step => step.isRequired).length;
    const approvedSteps = workflow.filter(step => step.isRequired && step.status === 'APPROVED').length;
    return totalSteps > 0 ? Math.round((approvedSteps / totalSteps) * 100) : 0;
  }

  /**
   * Approve a workflow step
   */
  approveStep(workflow: ApprovalStep[], stepId: number, approverId: string, approverName: string, comments?: string): ApprovalStep[] {
    const updatedWorkflow = [...workflow];
    const stepIndex = updatedWorkflow.findIndex(step => step.stepId === stepId);
    
    if (stepIndex >= 0) {
      updatedWorkflow[stepIndex] = {
        ...updatedWorkflow[stepIndex],
        status: 'APPROVED',
        approvedBy: approverName,
        approvedDate: new Date().toISOString(),
        comments: comments || ''
      };
    }
    
    return updatedWorkflow;
  }

  /**
   * Reject a workflow step
   */
  rejectStep(workflow: ApprovalStep[], stepId: number, approverId: string, approverName: string, comments: string): ApprovalStep[] {
    const updatedWorkflow = [...workflow];
    const stepIndex = updatedWorkflow.findIndex(step => step.stepId === stepId);
    
    if (stepIndex >= 0) {
      updatedWorkflow[stepIndex] = {
        ...updatedWorkflow[stepIndex],
        status: 'REJECTED',
        approvedBy: approverName,
        approvedDate: new Date().toISOString(),
        comments: comments
      };
    }
    
    return updatedWorkflow;
  }

  /**
   * Get approvers for current user based on their role/department
   */
  getApprovalRequestsForUser(userId: string, userDepartment: string, userRole: string): any[] {
    // This would typically fetch from API based on user's approval permissions
    // For now, return mock data structure
    return [];
  }

  /**
   * Check if user can approve a specific step
   */
  canUserApproveStep(step: ApprovalStep, userId: string, userDepartment: string, userRole: string): boolean {
    // Check if user is in the approver list for this step
    if (step.approverIds.includes(userId)) {
      return true;
    }

    // Check department-based approvals
    if (step.approverType === 'DEPARTMENT') {
      const stepDepartment = step.approverIds[0];
      return userDepartment.toLowerCase().includes(stepDepartment) || 
             userRole.toLowerCase().includes('admin') ||
             userRole.toLowerCase().includes('hod');
    }

    return false;
  }

  /**
   * Get approval status display text
   */
  getApprovalStatusText(status: string): string {
    switch (status) {
      case 'PENDING': return 'Pending Approval';
      case 'APPROVED': return 'Approved';
      case 'REJECTED': return 'Rejected';
      case 'IN_PROGRESS': return 'In Progress';
      default: return 'Unknown';
    }
  }

  /**
   * Get approval status CSS class
   */
  getApprovalStatusClass(status: string): string {
    switch (status) {
      case 'PENDING': return 'status-pending';
      case 'APPROVED': return 'status-approved';
      case 'REJECTED': return 'status-rejected';
      case 'IN_PROGRESS': return 'status-in-progress';
      default: return 'status-unknown';
    }
  }
}
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'replaceSpaces',
  standalone: true
})
export class ReplaceSpacesPipe implements PipeTransform {
  transform(value: string): string {
    if (!value) return '';
    return value.toLowerCase().replace(/\s+/g, '_');
  }
}

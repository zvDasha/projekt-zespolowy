import * as Dropdown from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';

export default function Select({ label, value, onChange, options, disabled = false, className = '' }) {
  return (
    <Dropdown.Root
      value={value || '__all__'}
      onValueChange={(next) => onChange(next === '__all__' ? '' : next)}
      disabled={disabled}
    >
      <Dropdown.Trigger className={`select-trigger ${className}`} aria-label={label}>
        <Dropdown.Value />
        <Dropdown.Icon className="select-arrow">
          <ChevronDown size={16} />
        </Dropdown.Icon>
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content className="select-content" position="popper" sideOffset={8} collisionPadding={12}>
          <Dropdown.ScrollUpButton className="select-scroll">
            <ChevronUp size={16} />
          </Dropdown.ScrollUpButton>
          <Dropdown.Viewport className="select-list">
            {options.map(([key, text]) => (
              <Dropdown.Item className="select-option" key={key} value={key || '__all__'}>
                <Dropdown.ItemText>{text}</Dropdown.ItemText>
                <Dropdown.ItemIndicator className="select-check">
                  <Check size={16} />
                </Dropdown.ItemIndicator>
              </Dropdown.Item>
            ))}
          </Dropdown.Viewport>
          <Dropdown.ScrollDownButton className="select-scroll">
            <ChevronDown size={16} />
          </Dropdown.ScrollDownButton>
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}

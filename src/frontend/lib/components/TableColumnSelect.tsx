import { t } from '@lingui/core/macro';
import {
  ActionIcon,
  Checkbox,
  Divider,
  Group,
  Menu,
  TextInput,
  Tooltip
} from '@mantine/core';
import {
  IconAdjustments,
  IconDeviceFloppy,
  IconTrash
} from '@tabler/icons-react';
import { useState } from 'react';

export function TableColumnSelect({
  columns,
  onToggleColumn,
  presets,
  onSavePreset,
  onApplyPreset,
  onDeletePreset
}: Readonly<{
  columns: any[];
  onToggleColumn: (columnName: string) => void;
  presets?: Record<string, string[]>;
  onSavePreset?: (name: string) => void;
  onApplyPreset?: (name: string) => void;
  onDeletePreset?: (name: string) => void;
}>) {
  const [presetName, setPresetName] = useState<string>('');

  const presetNames: string[] = Object.keys(presets ?? {}).sort();
  const presetsEnabled: boolean =
    !!onSavePreset && !!onApplyPreset && !!onDeletePreset;

  const savePreset = () => {
    if (!presetName.trim()) {
      return;
    }

    onSavePreset?.(presetName);
    setPresetName('');
  };

  return (
    <Menu shadow='xs' closeOnItemClick={false}>
      <Menu.Target>
        <ActionIcon variant='transparent' aria-label='table-select-columns'>
          <Tooltip label={t`Select Columns`} position='top-end'>
            <IconAdjustments />
          </Tooltip>
        </ActionIcon>
      </Menu.Target>

      <Menu.Dropdown style={{ maxHeight: '400px', overflowY: 'auto' }}>
        <Menu.Label>{t`Select Columns`}</Menu.Label>
        <Divider />
        {columns
          .filter((col) => (col.switchable ?? true) && !col.propHidden)
          .map((col) => (
            <Menu.Item key={col.accessor}>
              <Checkbox
                checked={!col.hidden}
                label={col.title || col.accessor}
                onChange={() => onToggleColumn(col.accessor)}
                radius='sm'
              />
            </Menu.Item>
          ))}
        {presetsEnabled && (
          <>
            <Divider />
            <Menu.Label>{t`Column Presets`}</Menu.Label>
            {presetNames.map((name) => (
              <Menu.Item key={name} onClick={() => onApplyPreset?.(name)}>
                <Group gap='xs' justify='space-between' wrap='nowrap'>
                  {name}
                  <ActionIcon
                    variant='transparent'
                    color='red'
                    size='sm'
                    aria-label={`delete-column-preset-${name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onDeletePreset?.(name);
                    }}
                  >
                    <Tooltip label={t`Delete preset`} position='top-end'>
                      <IconTrash size={16} />
                    </Tooltip>
                  </ActionIcon>
                </Group>
              </Menu.Item>
            ))}
            <Menu.Item>
              <Group gap='xs' wrap='nowrap'>
                <TextInput
                  size='xs'
                  value={presetName}
                  placeholder={t`Preset name`}
                  aria-label='column-preset-name'
                  onChange={(event) => setPresetName(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key == 'Enter') {
                      savePreset();
                    } else if (event.key != 'Escape') {
                      // Prevent the menu from hijacking keyboard input
                      // (but allow Escape to close the menu)
                      event.stopPropagation();
                    }
                  }}
                />
                <ActionIcon
                  variant='transparent'
                  size='sm'
                  disabled={!presetName.trim()}
                  aria-label='save-column-preset'
                  onClick={savePreset}
                >
                  <Tooltip label={t`Save current columns`} position='top-end'>
                    <IconDeviceFloppy size={16} />
                  </Tooltip>
                </ActionIcon>
              </Group>
            </Menu.Item>
          </>
        )}
      </Menu.Dropdown>
    </Menu>
  );
}

import { EmptyState } from "../ui/States";
import { Button } from "../ui";
import { PlusIcon } from "../ui/Icon";

interface Props {
  title: string;
  description: string;
  createLabel: string;
  onCreate: () => void;
}

export default function SubmissionsEmptyRow({ title, description, createLabel, onCreate }: Props) {
  return (
    <tr>
      <td colSpan={7} style={{ padding: 0 }}>
        <EmptyState
          title={title}
          description={description}
          compact
          action={
            <Button variant="primary" size="sm" onClick={onCreate}>
              <PlusIcon size="sm" /> {createLabel}
            </Button>
          }
        />
      </td>
    </tr>
  );
}

